import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import CameraIpConnect from "./CameraIpConnect";
import FaceOverlay from "./FaceOverlay";
import RotationControls from "./RotationControls";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useIpCameraStream } from "../hooks/useIpCameraStream";
import {
  getSavedRotation,
  nextRotation,
  saveRotation,
} from "../lib/rotateImage";
import { cropFaceToBase64, isFaceSourceReady } from "../lib/faceDetection";

/**
 * Gate camera — Camera IP only (phone IP Webcam).
 * Reports online/offline + face presence for status colors.
 */
const GateCamera = forwardRef(function GateCamera(
  { onFacePresenceChange, onCameraStatusChange },
  ref,
) {
  const sourceRef = useRef(null);

  const [activeIpUrl, setActiveIpUrl] = useState(
    () => localStorage.getItem("campus_ip_camera_url") || "",
  );
  const [rotation, setRotation] = useState(() => getSavedRotation());

  const {
    canvasRef: ipCanvasRef,
    frameReady: ipReady,
    error: ipError,
  } = useIpCameraStream(activeIpUrl, rotation, {
    enabled: Boolean(activeIpUrl),
  });

  const cameraOnline = Boolean(activeIpUrl && ipReady && !ipError);

  const syncSource = useCallback(() => {
    sourceRef.current = ipCanvasRef.current;
  }, [ipCanvasRef]);

  const { detectorReady, detectorError, displayBox, mediaBox } = useFaceDetection(
    sourceRef,
    {
      enabled: cameraOnline,
      mirrored: false,
      intervalMs: 120,
    },
  );

  const facePresent = Boolean(mediaBox);

  useEffect(() => {
    onFacePresenceChange?.(facePresent);
  }, [facePresent, onFacePresenceChange]);

  useEffect(() => {
    onCameraStatusChange?.({
      online: cameraOnline,
      connected: Boolean(activeIpUrl),
      error: ipError || detectorError || null,
    });
  }, [activeIpUrl, cameraOnline, detectorError, ipError, onCameraStatusChange]);

  useEffect(() => {
    syncSource();
  }, [syncSource, ipReady, rotation]);

  useImperativeHandle(
    ref,
    () => ({
      async captureFace() {
        syncSource();
        const el = sourceRef.current;
        if (!isFaceSourceReady(el)) {
          throw new Error("Camera image is not ready yet.");
        }
        if (!detectorReady) {
          throw new Error("Face detector is still loading.");
        }
        if (!mediaBox) {
          throw new Error("No face in view. Rotate until upright, then center the face.");
        }
        return cropFaceToBase64(el, mediaBox);
      },
      hasFace: () => Boolean(mediaBox),
      isOnline: () => cameraOnline,
    }),
    [cameraOnline, detectorReady, mediaBox, syncSource],
  );

  const handleIpConnect = useCallback((nextUrl) => {
    setActiveIpUrl(nextUrl);
  }, []);

  const handleRotate = () => {
    const next = nextRotation(rotation);
    setRotation(next);
    saveRotation(next);
  };

  let helper = "Waiting for a face…";
  let helperTone = "idle";
  if (!activeIpUrl) {
    helper = "Find phone or connect Camera IP";
    helperTone = "offline";
  } else if (ipError) {
    helper = ipError;
    helperTone = "offline";
  } else if (detectorError) {
    helper = "Camera setup incomplete — check face models";
    helperTone = "offline";
  } else if (!ipReady || !detectorReady) {
    helper = "Connecting camera…";
    helperTone = "online";
  } else if (facePresent) {
    helper = "Face locked — verifying…";
    helperTone = "online";
  } else {
    helper = "Camera online — center face in frame (Rotate if sideways)";
    helperTone = "online";
  }

  return (
    <div className="gate-camera">
      <div className="camera-status-row">
        <span className={`status-dot-lg ${cameraOnline ? "status-online" : "status-offline"}`} />
        <span className="camera-status-label">
          {cameraOnline ? "Camera online" : "Camera offline"}
        </span>
      </div>

      <CameraIpConnect activeUrl={activeIpUrl} onConnect={handleIpConnect} />
      <RotationControls rotation={rotation} onRotate={handleRotate} />

      <div className={`gate-preview ${cameraOnline ? "is-online" : "is-offline"}`}>
        {activeIpUrl ? (
          <canvas ref={ipCanvasRef} className="gate-media" />
        ) : (
          <div className="gate-preview-empty">Waiting for Camera IP</div>
        )}

        {facePresent && <FaceOverlay box={displayBox} />}
        {!facePresent && cameraOnline && detectorReady && (
          <div className="scan-frame" aria-hidden="true" />
        )}
      </div>

      <p className={`gate-helper tone-${helperTone}`} role="status">
        {helper}
      </p>
    </div>
  );
});

export default GateCamera;
