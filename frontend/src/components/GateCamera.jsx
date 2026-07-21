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
 * Gate camera — Camera IP with upright rotation + PC fallback.
 */
const GateCamera = forwardRef(function GateCamera({ onFacePresenceChange }, ref) {
  const webcamVideoRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("ip");
  const [activeIpUrl, setActiveIpUrl] = useState(
    () => localStorage.getItem("campus_ip_camera_url") || "",
  );
  const [rotation, setRotation] = useState(() => getSavedRotation());
  const [error, setError] = useState(null);
  const [pcReady, setPcReady] = useState(false);

  const isIp = mode === "ip";
  const mirrored = !isIp;

  const {
    canvasRef: ipCanvasRef,
    frameReady: ipReady,
    error: ipError,
  } = useIpCameraStream(activeIpUrl, rotation, {
    enabled: isIp && Boolean(activeIpUrl),
  });

  const syncSource = useCallback(() => {
    sourceRef.current = isIp ? ipCanvasRef.current : webcamVideoRef.current;
  }, [isIp, ipCanvasRef]);

  const sourceReady = isIp ? ipReady : pcReady;
  const combinedError = isIp ? ipError || error : error;

  const { detectorReady, detectorError, displayBox, mediaBox } = useFaceDetection(
    sourceRef,
    {
      enabled: sourceReady && !combinedError,
      mirrored,
      intervalMs: 120,
    },
  );

  const facePresent = Boolean(mediaBox);

  useEffect(() => {
    onFacePresenceChange?.(facePresent);
  }, [facePresent, onFacePresenceChange]);

  useEffect(() => {
    syncSource();
  }, [syncSource, ipReady, pcReady, mode, rotation]);

  useEffect(() => {
    if (isIp) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setPcReady(false);
      return undefined;
    }

    let cancelled = false;
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.onloadedmetadata = () => {
            webcamVideoRef.current?.play().catch(() => {});
            setPcReady(true);
            syncSource();
          };
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err?.name === "NotAllowedError"
            ? "Camera access is blocked on this computer."
            : "Could not open the PC camera.";
        setError(message);
        setPcReady(false);
      });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isIp, syncSource]);

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
    }),
    [detectorReady, mediaBox, syncSource],
  );

  const handleIpConnect = useCallback((nextUrl) => {
    setError(null);
    setActiveIpUrl(nextUrl);
  }, []);

  const handleRotate = () => {
    const next = nextRotation(rotation);
    setRotation(next);
    saveRotation(next);
  };

  let helper = "Waiting for a face…";
  if (combinedError) helper = combinedError;
  else if (isIp && !activeIpUrl) helper = "Find phone or wait for auto-reconnect";
  else if (detectorError) helper = "Camera setup incomplete — check face models in /public/models";
  else if (!detectorReady) helper = "Preparing detector…";
  else if (facePresent) helper = "Face locked — verifying…";
  else if (isIp) helper = "If sideways, tap Rotate. Center face in frame.";

  return (
    <div className="gate-camera">
      <div className="gate-source-tabs" role="tablist" aria-label="Camera source">
        <button
          type="button"
          data-active={isIp}
          onClick={() => {
            setMode("ip");
            setError(null);
          }}
        >
          Camera IP
        </button>
        <button
          type="button"
          data-active={!isIp}
          onClick={() => {
            setMode("pc");
            setError(null);
          }}
        >
          PC camera
        </button>
      </div>

      {isIp && (
        <>
          <CameraIpConnect activeUrl={activeIpUrl} onConnect={handleIpConnect} />
          <RotationControls rotation={rotation} onRotate={handleRotate} />
        </>
      )}

      <div className="gate-preview">
        {isIp ? (
          activeIpUrl ? (
            <canvas ref={ipCanvasRef} className="gate-media" />
          ) : (
            <div className="gate-preview-empty">Waiting for Camera IP</div>
          )
        ) : (
          <video ref={webcamVideoRef} muted playsInline className="gate-media mirror" />
        )}

        {facePresent && <FaceOverlay box={displayBox} />}
        {!facePresent && sourceReady && !combinedError && detectorReady && (
          <div className="scan-frame" aria-hidden="true" />
        )}
      </div>

      <p className="gate-helper" role="status">
        {helper}
      </p>
    </div>
  );
});

export default GateCamera;
