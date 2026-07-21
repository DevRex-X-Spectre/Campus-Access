import { useEffect, useRef, useState } from "react";
import { getIpCameraSnapshotUrl } from "../api/client";
import { drawImageRotated } from "../lib/rotateImage";

/**
 * Poll IP Webcam /shot.jpg, rotate pixels onto a canvas for upright display + detection.
 */
export function useIpCameraStream(activeUrl, rotationDeg, { enabled = true, intervalMs = 320 } = {}) {
  const canvasRef = useRef(null);
  const [frameReady, setFrameReady] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !activeUrl) {
      setFrameReady(false);
      return undefined;
    }

    let cancelled = false;

    const loadFrame = () => {
      if (cancelled || loadingRef.current) return;
      loadingRef.current = true;

      const img = new Image();
      img.crossOrigin = "anonymous";
      const src = `${getIpCameraSnapshotUrl(activeUrl)}&t=${Date.now()}`;

      img.onload = () => {
        loadingRef.current = false;
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ok = drawImageRotated(img, canvas, rotationDeg);
        if (ok) {
          setFrameReady(true);
          setError(null);
        }
      };

      img.onerror = () => {
        loadingRef.current = false;
        if (cancelled) return;
        setFrameReady(false);
        setError(
          "Could not load Camera IP snapshot. Check the URL and that the backend can reach the phone.",
        );
      };

      img.src = src;
    };

    loadFrame();
    const id = window.setInterval(loadFrame, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeUrl, enabled, intervalMs, rotationDeg]);

  return { canvasRef, frameReady, error, setError };
}
