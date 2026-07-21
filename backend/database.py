"""SQLite persistence: schema bootstrap and query helpers."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator, Iterable, Optional

from config import get_settings

VALID_ROLES = frozenset({"student", "staff"})


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    settings = get_settings()
    conn = sqlite3.connect(settings.sqlite_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def init_db() -> None:
    """Create / migrate tables and seed default areas."""
    with db_session() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS personnel (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student',
                matric_number TEXT,
                blacklisted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personnel_id INTEGER NOT NULL,
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS areas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                staff_only INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personnel_id INTEGER,
                area_id INTEGER,
                granted INTEGER NOT NULL DEFAULT 0,
                recognized INTEGER NOT NULL DEFAULT 0,
                reason TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL,
                FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel(name);
            CREATE INDEX IF NOT EXISTS idx_embeddings_personnel ON embeddings(personnel_id);
            """
        )

        # Lightweight migrations for DBs created before role/blacklist/areas.
        # Must run BEFORE indexes that reference new columns.
        personnel_cols = _column_names(conn, "personnel")
        if "role" not in personnel_cols:
            conn.execute(
                "ALTER TABLE personnel ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"
            )
        if "blacklisted" not in personnel_cols:
            conn.execute(
                "ALTER TABLE personnel ADD COLUMN blacklisted INTEGER NOT NULL DEFAULT 0"
            )
        if "matric_number" not in personnel_cols:
            conn.execute("ALTER TABLE personnel ADD COLUMN matric_number TEXT")

        log_cols = _column_names(conn, "access_log")
        if "area_id" not in log_cols:
            conn.execute("ALTER TABLE access_log ADD COLUMN area_id INTEGER")
        if "granted" not in log_cols:
            conn.execute(
                "ALTER TABLE access_log ADD COLUMN granted INTEGER NOT NULL DEFAULT 0"
            )
        if "reason" not in log_cols:
            conn.execute("ALTER TABLE access_log ADD COLUMN reason TEXT")

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role)"
        )

        # Seed default areas once.
        count = conn.execute("SELECT COUNT(*) AS c FROM areas").fetchone()["c"]
        if count == 0:
            now = _utc_now_iso()
            conn.executemany(
                "INSERT INTO areas (name, staff_only, created_at) VALUES (?, ?, ?)",
                [
                    ("Main Entrance", 0, now),
                    ("Library", 0, now),
                    ("Staff Office", 1, now),
                    ("Admin Block", 1, now),
                ],
            )


def find_personnel_by_name(conn: sqlite3.Connection, name: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT id, name, role, matric_number, blacklisted, created_at
        FROM personnel
        WHERE lower(name) = lower(?)
        LIMIT 1
        """,
        (name.strip(),),
    ).fetchone()


def find_personnel_by_matric(conn: sqlite3.Connection, matric_number: str) -> Optional[sqlite3.Row]:
    cleaned = matric_number.strip()
    if not cleaned:
        return None
    return conn.execute(
        """
        SELECT id, name, role, matric_number, blacklisted, created_at
        FROM personnel
        WHERE matric_number IS NOT NULL
          AND lower(matric_number) = lower(?)
        LIMIT 1
        """,
        (cleaned,),
    ).fetchone()


def get_personnel_by_id(conn: sqlite3.Connection, personnel_id: int) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT id, name, role, matric_number, blacklisted, created_at
        FROM personnel
        WHERE id = ?
        """,
        (personnel_id,),
    ).fetchone()


def create_personnel(
    conn: sqlite3.Connection,
    name: str,
    role: str,
    matric_number: Optional[str] = None,
) -> int:
    if role not in VALID_ROLES:
        raise ValueError("Role must be 'student' or 'staff'")
    matric = (matric_number or "").strip() or None
    cursor = conn.execute(
        """
        INSERT INTO personnel (name, role, matric_number, blacklisted, created_at)
        VALUES (?, ?, ?, 0, ?)
        """,
        (name.strip(), role, matric, _utc_now_iso()),
    )
    return int(cursor.lastrowid)


def insert_embedding(
    conn: sqlite3.Connection, personnel_id: int, embedding: Iterable[float]
) -> int:
    cursor = conn.execute(
        "INSERT INTO embeddings (personnel_id, embedding, created_at) VALUES (?, ?, ?)",
        (personnel_id, json.dumps(list(embedding)), _utc_now_iso()),
    )
    return int(cursor.lastrowid)


def list_personnel(
    conn: sqlite3.Connection, role: Optional[str] = None
) -> list[dict[str, Any]]:
    if role:
        if role not in VALID_ROLES:
            raise ValueError("Role must be 'student' or 'staff'")
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.name,
                p.role,
                p.matric_number,
                p.blacklisted,
                p.created_at,
                COUNT(e.id) AS embedding_count
            FROM personnel p
            LEFT JOIN embeddings e ON e.personnel_id = p.id
            WHERE p.role = ?
            GROUP BY p.id
            ORDER BY p.name COLLATE NOCASE ASC
            """,
            (role,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.name,
                p.role,
                p.matric_number,
                p.blacklisted,
                p.created_at,
                COUNT(e.id) AS embedding_count
            FROM personnel p
            LEFT JOIN embeddings e ON e.personnel_id = p.id
            GROUP BY p.id
            ORDER BY p.role ASC, p.name COLLATE NOCASE ASC
            """
        ).fetchall()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "role": row["role"],
            "matric_number": row["matric_number"],
            "blacklisted": bool(row["blacklisted"]),
            "created_at": row["created_at"],
            "embedding_count": row["embedding_count"],
        }
        for row in rows
    ]


def delete_personnel(conn: sqlite3.Connection, personnel_id: int) -> bool:
    cursor = conn.execute("DELETE FROM personnel WHERE id = ?", (personnel_id,))
    return cursor.rowcount > 0


def set_blacklisted(conn: sqlite3.Connection, personnel_id: int, blacklisted: bool) -> bool:
    cursor = conn.execute(
        "UPDATE personnel SET blacklisted = ? WHERE id = ?",
        (1 if blacklisted else 0, personnel_id),
    )
    return cursor.rowcount > 0


def fetch_gallery_embeddings(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """All embeddings with person metadata used for matching."""
    rows = conn.execute(
        """
        SELECT
            e.id AS embedding_id,
            e.personnel_id,
            e.embedding,
            p.name,
            p.role,
            p.blacklisted
        FROM embeddings e
        INNER JOIN personnel p ON p.id = e.personnel_id
        """
    ).fetchall()
    return [
        {
            "embedding_id": row["embedding_id"],
            "personnel_id": row["personnel_id"],
            "name": row["name"],
            "role": row["role"],
            "blacklisted": bool(row["blacklisted"]),
            "embedding": json.loads(row["embedding"]),
        }
        for row in rows
    ]


def list_areas(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, staff_only, created_at
        FROM areas
        ORDER BY name COLLATE NOCASE ASC
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "staff_only": bool(row["staff_only"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def get_area(conn: sqlite3.Connection, area_id: int) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, staff_only, created_at FROM areas WHERE id = ?",
        (area_id,),
    ).fetchone()


def create_area(conn: sqlite3.Connection, name: str, staff_only: bool) -> int:
    cursor = conn.execute(
        "INSERT INTO areas (name, staff_only, created_at) VALUES (?, ?, ?)",
        (name.strip(), 1 if staff_only else 0, _utc_now_iso()),
    )
    return int(cursor.lastrowid)


def update_area(
    conn: sqlite3.Connection,
    area_id: int,
    *,
    name: Optional[str] = None,
    staff_only: Optional[bool] = None,
) -> bool:
    area = get_area(conn, area_id)
    if area is None:
        return False
    next_name = name.strip() if name is not None else area["name"]
    next_staff = (
        (1 if staff_only else 0) if staff_only is not None else int(area["staff_only"])
    )
    conn.execute(
        "UPDATE areas SET name = ?, staff_only = ? WHERE id = ?",
        (next_name, next_staff, area_id),
    )
    return True


def delete_area(conn: sqlite3.Connection, area_id: int) -> bool:
    cursor = conn.execute("DELETE FROM areas WHERE id = ?", (area_id,))
    return cursor.rowcount > 0


def log_access(
    conn: sqlite3.Connection,
    *,
    recognized: bool,
    granted: bool,
    personnel_id: Optional[int],
    area_id: Optional[int],
    reason: str,
) -> None:
    conn.execute(
        """
        INSERT INTO access_log (
            personnel_id, area_id, granted, recognized, reason, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            personnel_id,
            area_id,
            1 if granted else 0,
            1 if recognized else 0,
            reason,
            _utc_now_iso(),
        ),
    )


def list_access_logs(conn: sqlite3.Connection, limit: int = 50) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            l.id,
            l.personnel_id,
            l.area_id,
            l.granted,
            l.recognized,
            l.reason,
            l.timestamp,
            p.name AS person_name,
            p.role AS person_role,
            a.name AS area_name
        FROM access_log l
        LEFT JOIN personnel p ON p.id = l.personnel_id
        LEFT JOIN areas a ON a.id = l.area_id
        ORDER BY l.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "personnel_id": row["personnel_id"],
            "area_id": row["area_id"],
            "granted": bool(row["granted"]),
            "recognized": bool(row["recognized"]),
            "reason": row["reason"] or "",
            "timestamp": row["timestamp"],
            "person_name": row["person_name"],
            "person_role": row["person_role"],
            "area_name": row["area_name"],
        }
        for row in rows
    ]
