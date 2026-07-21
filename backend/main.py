"""
Campus Access — FastAPI backend.

Gate: face recognition + area policy.
Admin: enroll students/staff, areas, blacklist, delete (PIN protected).

Run:
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import logging
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import (
    create_area,
    create_personnel,
    db_session,
    delete_area,
    delete_personnel,
    fetch_gallery_embeddings,
    find_personnel_by_matric,
    find_personnel_by_name,
    get_area,
    get_personnel_by_id,
    init_db,
    insert_embedding,
    list_access_logs,
    list_areas,
    list_personnel,
    log_access,
    set_blacklisted,
    update_area,
)
from schemas import (
    AccessLogItem,
    AccessLogListResponse,
    AdminPinRequest,
    AdminPinResponse,
    AreaCreateRequest,
    AreaItem,
    AreaListResponse,
    AreaUpdateRequest,
    BlacklistRequest,
    EnrollRequest,
    EnrollResponse,
    HealthResponse,
    PersonnelItem,
    PersonnelListResponse,
    RecognizeRequest,
    RecognizeResponse,
)
from services.embedding import generate_embedding, is_model_loaded, load_model
from services.ip_camera_discover import discover_ip_webcams, probe_snapshot_url
from services.matching import find_best_match

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("campus_access")

settings = get_settings()

MAX_IP_CAMERA_BYTES = 5 * 1024 * 1024
IP_CAMERA_TIMEOUT_SECONDS = 3


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    logger.info("Database schema ready")
    try:
        load_model()
    except Exception:
        logger.exception("Failed to load embedding model at startup")
        raise
    yield


app = FastAPI(
    title="Campus Access API",
    description="AI face recognition for campus access control",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_admin_pin(x_admin_pin: Optional[str] = Header(default=None, alias="X-Admin-Pin")) -> None:
    """Protect admin routes with a shared PIN (prototype-grade auth)."""
    expected = settings.admin_pin
    provided = (x_admin_pin or "").strip()
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin PIN.",
        )


def _require_model() -> None:
    if not is_model_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding model is not ready. Try again in a moment.",
        )


# ── Public ──────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if is_model_loaded() else "degraded",
        model_loaded=is_model_loaded(),
        match_threshold=settings.match_threshold,
    )


@app.get("/areas", response_model=AreaListResponse)
def get_public_areas() -> AreaListResponse:
    """Gate UI loads areas so the kiosk can select where scanning applies."""
    with db_session() as conn:
        areas = list_areas(conn)
    return AreaListResponse(
        areas=[AreaItem(**a) for a in areas],
        count=len(areas),
    )


@app.get("/ip-camera/probe")
def ip_camera_probe(url: str = Query(..., min_length=1)) -> dict:
    """
    Check whether a Camera IP snapshot URL is reachable from this PC.
    Used to auto-reconnect a remembered phone without a manual Connect click.
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid http:// or https:// snapshot URL.",
        )
    ok = probe_snapshot_url(url, timeout=1.5)
    return {"ok": ok, "url": url}


@app.get("/ip-camera/discover")
def ip_camera_discover() -> dict:
    """
    Scan this PC's Wi‑Fi subnet for IP Webcam phones (port 8080 /shot.jpg).
    Optimal when you do not want to type the phone IP by hand.
    """
    cameras = discover_ip_webcams()
    return {"cameras": cameras, "count": len(cameras)}


@app.get("/ip-camera/snapshot")
def ip_camera_snapshot(url: str = Query(..., min_length=1)) -> Response:
    """Proxy phone IP-camera snapshots (avoids browser CORS issues)."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid http:// or https:// snapshot URL.",
        )

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "CampusAccess/1.0",
            "Accept": "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=IP_CAMERA_TIMEOUT_SECONDS) as upstream:
            content_type = upstream.headers.get("content-type", "image/jpeg").split(";")[0]
            payload = upstream.read(MAX_IP_CAMERA_BYTES + 1)
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the IP camera snapshot URL.",
        ) from exc

    if len(payload) > MAX_IP_CAMERA_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="IP camera snapshot is too large.",
        )

    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The IP camera URL must return an image snapshot.",
        )

    return Response(
        content=payload,
        media_type=content_type,
        headers={"Cache-Control": "no-store"},
    )


@app.post("/recognize", response_model=RecognizeResponse)
def recognize(body: RecognizeRequest) -> RecognizeResponse:
    """
    Gate decision:
      unknown → denied
      blacklisted → denied
      student on staff-only area → denied (staff restricted)
      otherwise recognized → granted
    """
    _require_model()

    try:
        probe = generate_embedding(body.image)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedding generation failed during recognize")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate face embedding from the provided image.",
        ) from exc

    try:
        with db_session() as conn:
            area = get_area(conn, body.area_id)
            if area is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected area was not found. Choose a valid area.",
                )

            area_id = int(area["id"])
            area_name = area["name"]
            staff_only = bool(area["staff_only"])

            gallery = fetch_gallery_embeddings(conn)
            if not gallery:
                reason = "Access denied — no one is registered in the system yet."
                log_access(
                    conn,
                    recognized=False,
                    granted=False,
                    personnel_id=None,
                    area_id=area_id,
                    reason=reason,
                )
                return RecognizeResponse(
                    granted=False,
                    recognized=False,
                    name=None,
                    role=None,
                    confidence=0.0,
                    personnel_id=None,
                    area_id=area_id,
                    area_name=area_name,
                    reason=reason,
                    message=reason,
                )

            match = find_best_match(probe, gallery, settings.match_threshold)

            if not match.recognized:
                reason = "Access denied — unknown face. This person is not registered."
                log_access(
                    conn,
                    recognized=False,
                    granted=False,
                    personnel_id=None,
                    area_id=area_id,
                    reason=reason,
                )
                return RecognizeResponse(
                    granted=False,
                    recognized=False,
                    name=None,
                    role=None,
                    confidence=match.confidence,
                    personnel_id=None,
                    area_id=area_id,
                    area_name=area_name,
                    reason=reason,
                    message=reason,
                )

            person = get_personnel_by_id(conn, int(match.personnel_id))
            if person is None:
                reason = "Access denied — unknown face. This person is not registered."
                log_access(
                    conn,
                    recognized=False,
                    granted=False,
                    personnel_id=None,
                    area_id=area_id,
                    reason=reason,
                )
                return RecognizeResponse(
                    granted=False,
                    recognized=False,
                    confidence=match.confidence,
                    area_id=area_id,
                    area_name=area_name,
                    reason=reason,
                    message=reason,
                )

            name = person["name"]
            role = person["role"]
            matric = person["matric_number"]
            personnel_id = int(person["id"])
            label = f"{name} ({matric})" if role == "student" and matric else name

            if bool(person["blacklisted"]):
                reason = f"Access denied — {label} is blacklisted."
                log_access(
                    conn,
                    recognized=True,
                    granted=False,
                    personnel_id=personnel_id,
                    area_id=area_id,
                    reason=reason,
                )
                return RecognizeResponse(
                    granted=False,
                    recognized=True,
                    name=name,
                    role=role,
                    matric_number=matric,
                    confidence=match.confidence,
                    personnel_id=personnel_id,
                    area_id=area_id,
                    area_name=area_name,
                    reason=reason,
                    message=reason,
                )

            if staff_only and role == "student":
                reason = (
                    f"Access denied — {area_name} is restricted to staff only. "
                    f"{label} is registered as a student."
                )
                log_access(
                    conn,
                    recognized=True,
                    granted=False,
                    personnel_id=personnel_id,
                    area_id=area_id,
                    reason=reason,
                )
                return RecognizeResponse(
                    granted=False,
                    recognized=True,
                    name=name,
                    role=role,
                    matric_number=matric,
                    confidence=match.confidence,
                    personnel_id=personnel_id,
                    area_id=area_id,
                    area_name=area_name,
                    reason=reason,
                    message=reason,
                )

            reason = f"Access granted — welcome, {label}."
            log_access(
                conn,
                recognized=True,
                granted=True,
                personnel_id=personnel_id,
                area_id=area_id,
                reason=reason,
            )
            return RecognizeResponse(
                granted=True,
                recognized=True,
                name=name,
                role=role,
                matric_number=matric,
                confidence=match.confidence,
                personnel_id=personnel_id,
                area_id=area_id,
                area_name=area_name,
                reason=reason,
                message=reason,
            )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error during recognize")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to match face against the gallery.",
        ) from exc


# ── Admin (PIN) ──────────────────────────────────────────────────────────────


@app.post("/admin/verify-pin", response_model=AdminPinResponse)
def verify_admin_pin(body: AdminPinRequest) -> AdminPinResponse:
    if secrets.compare_digest(body.pin.strip(), settings.admin_pin):
        return AdminPinResponse(success=True, message="PIN accepted.")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin PIN.",
    )


@app.post(
    "/admin/enroll",
    response_model=EnrollResponse,
    dependencies=[Depends(require_admin_pin)],
)
def admin_enroll(body: EnrollRequest) -> EnrollResponse:
    _require_model()

    matric = body.matric_number
    if body.role == "student":
        if not matric:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matric number is required for student registration.",
            )
    else:
        # Staff does not use matric numbers
        matric = None

    try:
        embedding = generate_embedding(body.image)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedding generation failed during enroll")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate face embedding from the provided image.",
        ) from exc

    try:
        with db_session() as conn:
            if matric:
                by_matric = find_personnel_by_matric(conn, matric)
                if by_matric is not None and by_matric["name"].lower() != body.name.lower():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"Matric number '{matric}' is already used by {by_matric['name']}."
                        ),
                    )

            existing = find_personnel_by_name(conn, body.name)
            if existing is not None:
                if existing["role"] != body.role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"'{existing['name']}' is already registered as {existing['role']}. "
                            "Use the same role or delete the existing record first."
                        ),
                    )
                if (
                    matric
                    and existing["matric_number"]
                    and str(existing["matric_number"]).lower() != matric.lower()
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"'{existing['name']}' is already registered with a different "
                            f"matric number ({existing['matric_number']})."
                        ),
                    )
                personnel_id = int(existing["id"])
                is_new = False
                display_name = existing["name"]
                role = existing["role"]
                stored_matric = existing["matric_number"] or matric
            else:
                personnel_id = create_personnel(
                    conn, body.name, body.role, matric_number=matric
                )
                is_new = True
                display_name = body.name.strip()
                role = body.role
                stored_matric = matric

            insert_embedding(conn, personnel_id, embedding)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error during enroll")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store enrollment in the database.",
        ) from exc

    if role == "student" and stored_matric:
        who = f"{display_name} ({stored_matric})"
    else:
        who = display_name

    message = (
        f"Added another face sample for {who} ({role})."
        if not is_new
        else f"Registered {who} as {role}."
    )
    return EnrollResponse(
        success=True,
        message=message,
        personnel_id=personnel_id,
        name=display_name,
        role=role,
        matric_number=stored_matric,
        is_new_personnel=is_new,
    )


@app.get(
    "/admin/personnel",
    response_model=PersonnelListResponse,
    dependencies=[Depends(require_admin_pin)],
)
def admin_list_personnel(role: Optional[str] = Query(default=None)) -> PersonnelListResponse:
    if role is not None and role not in {"student", "staff"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role filter must be 'student' or 'staff'.",
        )
    try:
        with db_session() as conn:
            people = list_personnel(conn, role=role)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error listing personnel")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load personnel list.",
        ) from exc

    items = [PersonnelItem(**p) for p in people]
    return PersonnelListResponse(personnel=items, count=len(items))


@app.delete(
    "/admin/personnel/{personnel_id}",
    dependencies=[Depends(require_admin_pin)],
)
def admin_delete_personnel(personnel_id: int) -> dict:
    with db_session() as conn:
        ok = delete_personnel(conn, personnel_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found.")
    return {"success": True, "message": "Person deleted."}


@app.post(
    "/admin/personnel/{personnel_id}/blacklist",
    dependencies=[Depends(require_admin_pin)],
)
def admin_blacklist_personnel(personnel_id: int, body: BlacklistRequest) -> dict:
    with db_session() as conn:
        person = get_personnel_by_id(conn, personnel_id)
        if person is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found.")
        set_blacklisted(conn, personnel_id, body.blacklisted)
    action = "blacklisted" if body.blacklisted else "removed from blacklist"
    return {
        "success": True,
        "message": f"{person['name']} was {action}.",
        "blacklisted": body.blacklisted,
    }


@app.get(
    "/admin/areas",
    response_model=AreaListResponse,
    dependencies=[Depends(require_admin_pin)],
)
def admin_list_areas() -> AreaListResponse:
    with db_session() as conn:
        areas = list_areas(conn)
    return AreaListResponse(areas=[AreaItem(**a) for a in areas], count=len(areas))


@app.post(
    "/admin/areas",
    response_model=AreaItem,
    dependencies=[Depends(require_admin_pin)],
)
def admin_create_area(body: AreaCreateRequest) -> AreaItem:
    try:
        with db_session() as conn:
            area_id = create_area(conn, body.name, body.staff_only)
            area = get_area(conn, area_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create area")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create area. The name may already exist.",
        ) from exc
    return AreaItem(
        id=int(area["id"]),
        name=area["name"],
        staff_only=bool(area["staff_only"]),
        created_at=area["created_at"],
    )


@app.patch(
    "/admin/areas/{area_id}",
    response_model=AreaItem,
    dependencies=[Depends(require_admin_pin)],
)
def admin_update_area(area_id: int, body: AreaUpdateRequest) -> AreaItem:
    with db_session() as conn:
        ok = update_area(conn, area_id, name=body.name, staff_only=body.staff_only)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found.")
        area = get_area(conn, area_id)
    return AreaItem(
        id=int(area["id"]),
        name=area["name"],
        staff_only=bool(area["staff_only"]),
        created_at=area["created_at"],
    )


@app.delete(
    "/admin/areas/{area_id}",
    dependencies=[Depends(require_admin_pin)],
)
def admin_delete_area(area_id: int) -> dict:
    with db_session() as conn:
        ok = delete_area(conn, area_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Area not found.")
    return {"success": True, "message": "Area deleted."}


@app.get(
    "/admin/logs",
    response_model=AccessLogListResponse,
    dependencies=[Depends(require_admin_pin)],
)
def admin_access_logs(limit: int = Query(default=40, ge=1, le=200)) -> AccessLogListResponse:
    with db_session() as conn:
        logs = list_access_logs(conn, limit=limit)
    items = [AccessLogItem(**row) for row in logs]
    return AccessLogListResponse(logs=items, count=len(items))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
