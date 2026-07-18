"""
Cosine-similarity matching against stored face embeddings.

Strategy (best match wins):
  1. Compare the probe embedding to every stored embedding.
  2. Keep the single highest cosine score.
  3. If that score is >= MATCH_THRESHOLD, return the associated person; else unknown.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Sequence

import numpy as np


@dataclass
class MatchResult:
    recognized: bool
    name: Optional[str]
    personnel_id: Optional[int]
    confidence: float  # raw cosine similarity in [−1, 1], typically [0, 1] for faces


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """
    Cosine similarity between two equal-length vectors.
    Vectors are expected to be L2-normalized, but we re-normalize defensively
    so legacy / non-normalized rows still compare safely.
    """
    va = np.asarray(a, dtype=np.float64)
    vb = np.asarray(b, dtype=np.float64)

    if va.shape != vb.shape:
        raise ValueError(f"Embedding dimension mismatch: {va.shape} vs {vb.shape}")

    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    # Clamp for floating-point safety (dot of unit vectors can slightly exceed ±1).
    score = float(np.dot(va, vb) / (norm_a * norm_b))
    return max(-1.0, min(1.0, score))


def find_best_match(
    probe: Sequence[float],
    gallery: list[dict[str, Any]],
    threshold: float,
) -> MatchResult:
    """
    gallery items must include: embedding (list[float]), name (str), personnel_id (int).
    Returns unknown if the gallery is empty or no score meets the threshold.
    """
    if not gallery:
        return MatchResult(
            recognized=False,
            name=None,
            personnel_id=None,
            confidence=0.0,
        )

    best_score = -1.0
    best_name: Optional[str] = None
    best_id: Optional[int] = None

    for item in gallery:
        score = cosine_similarity(probe, item["embedding"])
        if score > best_score:
            best_score = score
            best_name = item["name"]
            best_id = item["personnel_id"]

    if best_score >= threshold:
        return MatchResult(
            recognized=True,
            name=best_name,
            personnel_id=best_id,
            confidence=round(best_score, 6),
        )

    return MatchResult(
        recognized=False,
        name=None,
        personnel_id=None,
        confidence=round(best_score if best_score > -1.0 else 0.0, 6),
    )
