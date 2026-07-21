/**
 * Client-side face detection ONLY — TinyFaceDetector via face-api.js.
 * No landmarks, no recognition net, no SSD MobileNet.
 *
 * Coordinate notes:
 * - face-api returns boxes in the source media pixel space.
 * - react-webcam `mirrored` applies CSS scaleX(-1); overlay must flip X for display.
 * - Crops always use raw, unmirrored source pixels so the backend sees a real face.
 */

import * as faceapi from "face-api.js";

const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL || "/models";

let modelsLoaded = false;
let loadPromise = null;

export function areModelsLoaded() {
  return modelsLoaded;
}

/**
 * Load TinyFaceDetector weights once. Safe to call repeatedly.
 */
export async function loadTinyFaceDetector() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Guard: missing weights often return HTML (index.html) → JSON parse errors.
    const probe = await fetch(`${MODEL_URL}/tiny_face_detector_model-weights_manifest.json`);
    const contentType = probe.headers.get("content-type") || "";
    if (!probe.ok || contentType.includes("text/html")) {
      throw new Error("Face detector weights are missing or invalid.");
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

/**
 * Detect the single strongest face in a video or image element.
 * Returns { detection, mediaBox } where mediaBox is in source pixel space,
 * or null if none found.
 */
export async function detectLargestFace(video) {
  if (!modelsLoaded) {
    throw new Error("Face detector is not loaded yet");
  }

  const dimensions = getSourceDimensions(video);
  if (!dimensions) {
    return null;
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const detections = await faceapi.detectAllFaces(video, options);
  if (!detections.length) return null;

  // Prefer the largest box (area) — typical for access-control selfies.
  const detection = detections.reduce((best, current) => {
    const bestArea = best.box.width * best.box.height;
    const currentArea = current.box.width * current.box.height;
    return currentArea > bestArea ? current : best;
  });

  return {
    detection,
    mediaBox: {
      x: detection.box.x,
      y: detection.box.y,
      width: detection.box.width,
      height: detection.box.height,
    },
    score: detection.score,
  };
}

/**
 * Map a media-space box onto the rendered (CSS) preview box.
 * When the preview is CSS-mirrored, flip X so the overlay tracks the selfie view.
 */
export function mediaBoxToDisplay(mediaBox, video, { mirrored = true } = {}) {
  if (!mediaBox || !video) return null;

  const dimensions = getSourceDimensions(video);
  if (!dimensions) return null;

  const { width: vw, height: vh } = dimensions;
  const dw = video.clientWidth;
  const dh = video.clientHeight;
  if (!vw || !vh || !dw || !dh) return null;

  const scale = Math.max(dw / vw, dh / vh);
  const renderedWidth = vw * scale;
  const renderedHeight = vh * scale;
  const offsetX = (dw - renderedWidth) / 2;
  const offsetY = (dh - renderedHeight) / 2;

  let x = mediaBox.x * scale + offsetX;
  const y = mediaBox.y * scale + offsetY;
  const width = mediaBox.width * scale;
  const height = mediaBox.height * scale;

  if (mirrored) {
    x = dw - x - width;
  }

  return { x, y, width, height };
}

/**
 * Crop a face from a video or image element using a media-space box.
 * Adds padding so the embedding model sees a full face, not a tight cut.
 * Returns a JPEG data URL (base64) suitable for the API.
 */
export function cropFaceToBase64(video, mediaBox, { padding = 0.25, quality = 0.92 } = {}) {
  if (!video || !mediaBox) {
    throw new Error("Video and face detection are required to crop");
  }

  const dimensions = getSourceDimensions(video);
  if (!dimensions) {
    throw new Error("Camera image is not ready yet.");
  }

  const { x, y, width, height } = mediaBox;
  const padX = width * padding;
  const padY = height * padding;

  let sx = x - padX;
  let sy = y - padY;
  let sw = width + padX * 2;
  let sh = height + padY * 2;

  // Clamp to video bounds (media pixels)
  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(dimensions.width - sx, sw);
  sh = Math.min(dimensions.height - sy, sh);

  if (sw < 16 || sh < 16) {
    throw new Error("Detected face region is too small. Move closer to the camera.");
  }

  const canvas = document.createElement("canvas");
  // Square canvas helps the 160×160 embedding preprocess.
  const size = Math.max(sw, sh);
  canvas.width = Math.round(size);
  canvas.height = Math.round(size);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas for face crop");
  }

  const dx = (size - sw) / 2;
  const dy = (size - sh) / 2;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, sw, sh);

  return canvas.toDataURL("image/jpeg", quality);
}

export function isFaceSourceReady(source) {
  if (!source) return false;

  if (source instanceof HTMLVideoElement) {
    return source.readyState >= 2 && Boolean(source.videoWidth && source.videoHeight);
  }

  if (source instanceof HTMLImageElement) {
    return source.complete && Boolean(source.naturalWidth && source.naturalHeight);
  }

  return false;
}

function getSourceDimensions(source) {
  if (!source) return null;

  if (source instanceof HTMLVideoElement) {
    if (!source.videoWidth || !source.videoHeight) return null;
    return { width: source.videoWidth, height: source.videoHeight };
  }

  if (source instanceof HTMLImageElement) {
    if (!source.naturalWidth || !source.naturalHeight) return null;
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  return null;
}
