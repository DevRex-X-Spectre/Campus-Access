"""SQLite persistence: schema bootstrap and lightweight query helpers."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator, Iterable, Optional

from config import get_settings


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


def init_db() -> None:
    """Create tables if they do not already exist."""
    with db_session() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS personnel (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personnel_id INTEGER NOT NULL,
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                personnel_id INTEGER,
                recognized INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_personnel_name
                ON personnel(name);

            CREATE INDEX IF NOT EXISTS idx_embeddings_personnel
                ON embeddings(personnel_id);
            """
        )


def find_personnel_by_name(conn: sqlite3.Connection, name: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, created_at FROM personnel WHERE lower(name) = lower(?) LIMIT 1",
        (name.strip(),),
    ).fetchone()


def create_personnel(conn: sqlite3.Connection, name: str) -> int:
    cursor = conn.execute(
        "INSERT INTO personnel (name, created_at) VALUES (?, ?)",
        (name.strip(), _utc_now_iso()),
    )
    return int(cursor.lastrowid)


def insert_embedding(conn: sqlite3.Connection, personnel_id: int, embedding: Iterable[float]) -> int:
    cursor = conn.execute(
        "INSERT INTO embeddings (personnel_id, embedding, created_at) VALUES (?, ?, ?)",
        (personnel_id, json.dumps(list(embedding)), _utc_now_iso()),
    )
    return int(cursor.lastrowid)


def list_personnel(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            p.id,
            p.name,
            p.created_at,
            COUNT(e.id) AS embedding_count
        FROM personnel p
        LEFT JOIN embeddings e ON e.personnel_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "created_at": row["created_at"],
            "embedding_count": row["embedding_count"],
        }
        for row in rows
    ]


def fetch_all_embeddings(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Return every stored embedding with its personnel id and name."""
    rows = conn.execute(
        """
        SELECT
            e.id AS embedding_id,
            e.personnel_id,
            e.embedding,
            p.name
        FROM embeddings e
        INNER JOIN personnel p ON p.id = e.personnel_id
        """
    ).fetchall()
    result: list[dict[str, Any]] = []
    for row in rows:
        result.append(
            {
                "embedding_id": row["embedding_id"],
                "personnel_id": row["personnel_id"],
                "name": row["name"],
                "embedding": json.loads(row["embedding"]),
            }
        )
    return result


def log_access(
    conn: sqlite3.Connection,
    *,
    recognized: bool,
    personnel_id: Optional[int],
) -> None:
    conn.execute(
        "INSERT INTO access_log (personnel_id, recognized, timestamp) VALUES (?, ?, ?)",
        (personnel_id, 1 if recognized else 0, _utc_now_iso()),
    )
