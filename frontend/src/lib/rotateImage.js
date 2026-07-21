/**
 * Draw an image onto a canvas with 0/90/180/270° rotation.
 * Phone IP Webcam JPEGs are often landscape sensor data while the phone is held upright.
 * CSS rotation alone does NOT fix face-api detection — pixels must be rotated.
 */

export const ROTATION_KEY = "campus_ip_camera_rotation";

export function getSavedRotation() {
  const raw = Number(localStorage.getItem(ROTATION_KEY));
  if ([0, 90, 180, 270].includes(raw)) return raw;
  // Default 90° — typical for upright phone + IP Webcam /shot.jpg
  return 90;
}

export function saveRotation(deg) {
  localStorage.setItem(ROTATION_KEY, String(deg));
}

export function nextRotation(deg) {
  return (Number(deg) + 90) % 360;
}

/**
 * @param {CanvasImageSource} source
 * @param {HTMLCanvasElement} canvas
 * @param {number} rotationDeg 0 | 90 | 180 | 270
 */
export function drawImageRotated(source, canvas, rotationDeg = 0) {
  const deg = ((Number(rotationDeg) % 360) + 360) % 360;
  const sw =
    source.naturalWidth ||
    source.videoWidth ||
    source.width ||
    0;
  const sh =
    source.naturalHeight ||
    source.videoHeight ||
    source.height ||
    0;

  if (!sw || !sh) return false;

  const swap = deg === 90 || deg === 270;
  canvas.width = swap ? sh : sw;
  canvas.height = swap ? sw : sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (deg === 0) {
    ctx.drawImage(source, 0, 0);
  } else if (deg === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, 0, 0);
  } else if (deg === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0);
  } else if (deg === 270) {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(source, 0, 0);
  }

  ctx.restore();
  return true;
}
