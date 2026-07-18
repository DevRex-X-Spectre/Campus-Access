"""
Face embedding generation with facenet-pytorch InceptionResnetV1 (VGGFace2).

The backend never runs face detection. It expects an already-cropped face image
from the frontend (TinyFaceDetector crop). Output is a L2-normalized 512-d vector.
"""

from __future__ import annotations

import base64
import logging
import threading
from io import BytesIO
from typing import List

import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from torchvision import transforms

logger = logging.getLogger(__name__)

# InceptionResnetV1 (VGGFace2) expects 160×160 RGB, values roughly in [-1, 1].
_PREPROCESS = transforms.Compose(
    [
        transforms.Resize((160, 160)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ]
)

_model = None
_model_lock = threading.Lock()
_model_ready = False


def is_model_loaded() -> bool:
    return _model_ready


def load_model() -> None:
    """
    Load InceptionResnetV1 once at process start.
    Thread-safe; subsequent calls are no-ops.
    """
    global _model, _model_ready
    if _model_ready:
        return

    with _model_lock:
        if _model_ready:
            return

        # Import here so app can boot even if torch is slow to import on free tiers.
        from facenet_pytorch import InceptionResnetV1

        logger.info("Loading InceptionResnetV1 (VGGFace2) on CPU…")
        model = InceptionResnetV1(pretrained="vggface2").eval()
        model.to(torch.device("cpu"))
        # Disable gradients permanently — inference only.
        for param in model.parameters():
            param.requires_grad_(False)

        _model = model
        _model_ready = True
        logger.info("Embedding model ready (512-d output).")


def decode_base64_image(image_b64: str) -> Image.Image:
    """
    Decode a base64 string (raw or data-URL) into an RGB PIL Image.
    Raises ValueError on empty/invalid payloads.
    """
    if not image_b64 or not image_b64.strip():
        raise ValueError("Image payload is empty")

    payload = image_b64.strip()
    # Support data:image/jpeg;base64,<data>
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]

    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:  # noqa: BLE001 — surface as validation error
        raise ValueError("Image is not valid base64") from exc

    if not raw:
        raise ValueError("Decoded image is empty")

    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Image could not be decoded as a supported image format") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Failed to open image") from exc

    return image.convert("RGB")


def generate_embedding(image_b64: str) -> List[float]:
    """
    Generate a 512-dimensional L2-normalized face embedding from a cropped face image.
    """
    if not _model_ready or _model is None:
        raise RuntimeError("Embedding model is not loaded yet")

    image = decode_base64_image(image_b64)
    tensor = _PREPROCESS(image).unsqueeze(0)  # shape: (1, 3, 160, 160)

    with torch.inference_mode():
        embedding = _model(tensor)  # shape: (1, 512)
        # L2-normalize so cosine similarity == dot product (stable comparisons).
        embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)

    vector = embedding.squeeze(0).cpu().numpy().astype(np.float64)
    if vector.shape != (512,):
        raise RuntimeError(f"Unexpected embedding shape: {vector.shape}")

    return vector.tolist()
