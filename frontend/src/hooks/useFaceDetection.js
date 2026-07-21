import { useCallback, useEffect, useRef, useState } from "react";
import {
  areModelsLoaded,
  detectLargestFace,
  isFaceSourceReady,
  loadTinyFaceDetector,
  mediaBoxToDisplay,
} from "../lib/faceDetection";

/**
 * Polls TinyFaceDetector on a video element.
 * Returns:
 *  - displayBox: CSS-pixel box for overlay (mirrored-aware)
 *  - mediaBox: video-pixel box for cropping
 */
export function useFaceDetection(
  videoRef,
  { enabled = true, intervalMs = 120, mirrored = true } = {},
) {
  const [detectorReady, setDetectorReady] = useState(areModelsLoaded());
  const [detectorError, setDetectorError] = useState(null);
  const [displayBox, setDisplayBox] = useState(null);
  const [mediaBox, setMediaBox] = useState(null);
  const [score, setScore] = useState(null);
  const rafRef = useRef(null);
  const lastRunRef = useRef(0);
  const runningRef = useRef(false);

  const clearDetection = useCallback(() => {
    setDisplayBox(null);
    setMediaBox(null);
    setScore(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadTinyFaceDetector()
      .then(() => {
        if (!cancelled) {
          setDetectorReady(true);
          setDetectorError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Keep UI free of raw stack / JSON parse noise.
          setDetectorError("setup_failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tick = useCallback(
    async (timestamp) => {
      rafRef.current = requestAnimationFrame(tick);

      if (!enabled || !detectorReady || runningRef.current) return;
      if (timestamp - lastRunRef.current < intervalMs) return;

      const video = videoRef.current;
      if (!isFaceSourceReady(video)) {
        clearDetection();
        return;
      }

      lastRunRef.current = timestamp;
      runningRef.current = true;

      try {
        const result = await detectLargestFace(video);
        if (!result) {
          clearDetection();
        } else {
          setMediaBox(result.mediaBox);
          setScore(result.score ?? null);
          setDisplayBox(
            mediaBoxToDisplay(result.mediaBox, video, { mirrored }),
          );
        }
      } catch {
        clearDetection();
      } finally {
        runningRef.current = false;
      }
    },
    [clearDetection, detectorReady, enabled, intervalMs, mirrored, videoRef],
  );

  useEffect(() => {
    if (!enabled) {
      clearDetection();
    }
  }, [clearDetection, enabled]);

  useEffect(() => {
    if (!detectorReady) return undefined;

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [detectorReady, tick]);

  return { detectorReady, detectorError, displayBox, mediaBox, score };
}
