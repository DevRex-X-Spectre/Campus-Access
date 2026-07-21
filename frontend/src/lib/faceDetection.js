/**
 * Client-side face detection ONLY — TinyFaceDetector via face-api.js.
 * Supports video, image, and canvas (rotated IP camera frames).
 */

import * as faceapi from "face-api.js";

const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL || "/models";

let modelsLoaded = false;
let loadPromise = null;

export function areModelsLoaded() {
  return modelsLoaded;
}

export async function loadTinyFaceDetector() {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
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

export async function detectLargestFace(input) {
  if (!modelsLoaded) {
    throw new Error("Face detector is not loaded yet");
  }

  const dimensions = getSourceDimensions(input);
  if (!dimensions) {
    return null;
  }

  // Slightly lower threshold + larger input for dim / phone IP frames
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.35,
  });

  const detections = await faceapi.detectAllFaces(input, options);
  if (!detections.length) return null;

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

export function mediaBoxToDisplay(mediaBox, element, { mirrored = true } = {}) {
  if (!mediaBox || !element) return null;

  const dimensions = getSourceDimensions(element);
  if (!dimensions) return null;

  const { width: vw, height: vh } = dimensions;
  const dw = element.clientWidth;
  const dh = element.clientHeight;
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

export function cropFaceToBase64(source, mediaBox, { padding = 0.25, quality = 0.92 } = {}) {
  if (!source || !mediaBox) {
    throw new Error("Video and face detection are required to crop");
  }

  const dimensions = getSourceDimensions(source);
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

  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(dimensions.width - sx, sw);
  sh = Math.min(dimensions.height - sy, sh);

  if (sw < 16 || sh < 16) {
    throw new Error("Detected face region is too small. Move closer to the camera.");
  }

  const canvas = document.createElement("canvas");
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
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, sw, sh);

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

  if (source instanceof HTMLCanvasElement) {
    return source.width > 16 && source.height > 16;
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

  if (source instanceof HTMLCanvasElement) {
    if (!source.width || !source.height) return null;
    return { width: source.width, height: source.height };
  }

  return null;
}
