"""
Campus Access — FastAPI backend.

Run (local or Render):
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import (
    create_personnel,
    db_session,
    fetch_all_embeddings,
    find_personnel_by_name,
    init_db,
    insert_embedding,
    list_personnel,
    log_access,
)
from schemas import (
    EnrollRequest,
    EnrollResponse,
    HealthResponse,
    PersonnelItem,
    PersonnelListResponse,
    RecognizeRequest,
    RecognizeResponse,
)
from services.embedding import generate_embedding, is_model_loaded, load_model
from services.matching import find_best_match

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("campus_access")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    logger.info("Database schema ready")
    try:
        load_model()
    except Exception:
        # Surface clearly on free-tier cold starts; endpoints will 503 if model failed.
        logger.exception("Failed to load embedding model at startup")
        raise
    yield


app = FastAPI(
    title="Campus Access API",
    description="AI face recognition prototype for campus access control",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if is_model_loaded() else "degraded",
        model_loaded=is_model_loaded(),
        match_threshold=settings.match_threshold,
    )


@app.post("/enroll", response_model=EnrollResponse)
def enroll(body: EnrollRequest) -> EnrollResponse:
    if not is_model_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding model is not ready. Try again in a moment.",
        )

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
            existing = find_personnel_by_name(conn, body.name)
            if existing is not None:
                personnel_id = int(existing["id"])
                is_new = False
                display_name = existing["name"]
            else:
                personnel_id = create_personnel(conn, body.name)
                is_new = True
                display_name = body.name.strip()

            insert_embedding(conn, personnel_id, embedding)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error during enroll")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store enrollment in the database.",
        ) from exc

    message = (
        f"Enrolled a new face sample for {display_name}."
        if not is_new
        else f"Successfully enrolled {display_name}."
    )
    return EnrollResponse(
        success=True,
        message=message,
        personnel_id=personnel_id,
        name=display_name,
        is_new_personnel=is_new,
    )


@app.post("/recognize", response_model=RecognizeResponse)
def recognize(body: RecognizeRequest) -> RecognizeResponse:
    if not is_model_loaded():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding model is not ready. Try again in a moment.",
        )

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
            gallery = fetch_all_embeddings(conn)
            if not gallery:
                # Always log unknown attempts, even with an empty gallery.
                log_access(conn, recognized=False, personnel_id=None)
                return RecognizeResponse(
                    recognized=False,
                    name=None,
                    confidence=0.0,
                    personnel_id=None,
                    message="No enrolled faces yet. Enroll someone first.",
                )

            match = find_best_match(probe, gallery, settings.match_threshold)
            log_access(
                conn,
                recognized=match.recognized,
                personnel_id=match.personnel_id,
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error during recognize")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to match face against the gallery.",
        ) from exc

    if match.recognized:
        return RecognizeResponse(
            recognized=True,
            name=match.name,
            confidence=match.confidence,
            personnel_id=match.personnel_id,
            message=f"Recognized as {match.name}.",
        )

    return RecognizeResponse(
        recognized=False,
        name=None,
        confidence=match.confidence,
        personnel_id=None,
        message="Face not recognized.",
    )


@app.get("/personnel", response_model=PersonnelListResponse)
def get_personnel() -> PersonnelListResponse:
    try:
        with db_session() as conn:
            people = list_personnel(conn)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database error listing personnel")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load personnel list.",
        ) from exc

    items = [PersonnelItem(**person) for person in people]
    return PersonnelListResponse(personnel=items, count=len(items))


if __name__ == "__main__":
    import uvicorn

    # Render injects PORT; default 8000 for local runs.
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
