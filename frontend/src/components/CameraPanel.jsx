import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Webcam from "react-webcam";
import { getIpCameraSnapshotUrl } from "../api/client";
import FaceOverlay from "./FaceOverlay";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { cropFaceToBase64, isFaceSourceReady } from "../lib/faceDetection";

/**
 * Cream panel: camera stays fixed on mobile (parent does not scroll this block).
 * Layout matches the mobile screenshot: brand → title → video → short status.
 */
const CameraPanel = forwardRef(function CameraPanel(
  { cameraEnabled = true, onCameraError },
  ref,
) {
  const webcamRef = useRef(null);
  const ipImageRef = useRef(null);
  const videoRef = useRef(null);
  const [cameraSource, setCameraSource] = useState("webcam");
  const [ipCameraUrl, setIpCameraUrl] = useState("");
  const [activeIpCameraUrl, setActiveIpCameraUrl] = useState("");
  const [ipFrameUrl, setIpFrameUrl] = useState("");
  const [ipCameraError, setIpCameraError] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const isIpCamera = cameraSource === "ip";
  const mirrored = !isIpCamera;

  const syncVideoNode = useCallback(() => {
    videoRef.current = isIpCamera
      ? ipImageRef.current
      : webcamRef.current?.video ?? null;
  }, [isIpCamera]);

  const cameraError = isIpCamera ? ipCameraError : permissionError;
  const sourceReady = !isIpCamera || Boolean(activeIpCameraUrl);

  const { detectorReady, detectorError, displayBox, mediaBox } = useFaceDetection(
    videoRef,
    {
      enabled: cameraEnabled && sourceReady && !cameraError,
      mirrored,
    },
  );

  useEffect(() => {
    syncVideoNode();
  }, [cameraSource, ipFrameUrl, syncVideoNode]);

  useEffect(() => {
    if (!isIpCamera || !activeIpCameraUrl) return undefined;

    const refreshFrame = () => {
      const snapshotUrl = getIpCameraSnapshotUrl(activeIpCameraUrl);
      setIpFrameUrl(`${snapshotUrl}&t=${Date.now()}`);
    };

    refreshFrame();
    const intervalId = window.setInterval(refreshFrame, 350);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeIpCameraUrl, isIpCamera]);

  const handleUserMedia = useCallback(() => {
    setPermissionError(null);
    syncVideoNode();
  }, [syncVideoNode]);

  const handleUserMediaError = useCallback(
    (err) => {
      const message =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Camera access is blocked. Allow the camera in your browser settings, then refresh."
          : err?.name === "NotFoundError"
            ? "No camera was found on this device."
            : "We couldn’t open the camera. Check permissions and try again.";
      setPermissionError(message);
      onCameraError?.(message);
    },
    [onCameraError],
  );

  const handleCameraSourceChange = useCallback((nextSource) => {
    setCameraSource(nextSource);
    setPermissionError(null);
    setIpCameraError(null);
  }, []);

  const handleIpCameraSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const nextUrl = ipCameraUrl.trim();
      setIpCameraError(null);
      setActiveIpCameraUrl(nextUrl);
      setIpFrameUrl("");
      syncVideoNode();
    },
    [ipCameraUrl, syncVideoNode],
  );

  useImperativeHandle(
    ref,
    () => ({
      async captureFace() {
        syncVideoNode();
        const video = videoRef.current;
        if (!isFaceSourceReady(video)) {
          throw new Error("The camera image is still starting. Please wait a moment.");
        }
        if (!detectorReady) {
          throw new Error("Getting ready… Please wait a moment and try again.");
        }
        if (!mediaBox) {
          throw new Error("No face in view. Center your face in the frame and try again.");
        }
        return cropFaceToBase64(video, mediaBox);
      },
      hasFace: () => Boolean(mediaBox),
      isReady: () => Boolean(detectorReady && !cameraError),
    }),
    [cameraError, detectorReady, mediaBox, syncVideoNode],
  );

  const faceReady = Boolean(mediaBox);
  const systemReady = detectorReady && !detectorError && sourceReady && !cameraError;

  let helperText = "Center your face in the frame";
  let helperTone = "idle";

  if (cameraError) {
    helperText = cameraError;
    helperTone = "error";
  } else if (isIpCamera && !activeIpCameraUrl) {
    helperText = "Enter the phone snapshot URL";
  } else if (detectorError) {
    helperText = "Camera setup is incomplete. Refresh the page or try again shortly.";
    helperTone = "error";
  } else if (!detectorReady) {
    helperText = "Preparing camera…";
    helperTone = "loading";
  } else if (faceReady) {
    helperText = "Face ready";
    helperTone = "ready";
  }

  return (
    <section
      className={[
        "relative w-full bg-cream-paper text-void-black",
        // Mobile: compact fixed block — content-sized, no min-height fight
        "flex flex-col items-center px-20 pb-20 pt-24",
        // Desktop: fill the left half and center content
        "md:flex md:h-full md:min-h-0 md:items-center md:justify-center md:px-40 md:py-56",
      ].join(" ")}
    >
      <div className="flex w-full max-w-[520px] flex-col items-center animate-fade-up md:max-w-[620px] lg:max-w-[700px]">
        <p className="mb-8 font-telka text-caption font-light uppercase tracking-[0.14em] text-void-black/55">
          Campus Access
        </p>
        <h1 className="mb-20 text-center font-telka text-[22px] font-regular tracking-[-0.02em] text-void-black md:mb-28 md:text-[24px]">
          Look at the camera
        </h1>

        <div className="mb-16 flex w-full flex-col gap-10 animate-fade-up animate-delay-1">
          <div
            className="camera-source-segment"
            role="tablist"
            aria-label="Camera source"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isIpCamera}
              data-active={!isIpCamera}
              onClick={() => handleCameraSourceChange("webcam")}
            >
              PC camera
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isIpCamera}
              data-active={isIpCamera}
              onClick={() => handleCameraSourceChange("ip")}
            >
              Phone IP
            </button>
          </div>

          {isIpCamera && (
            <form className="flex gap-8 animate-fade-in" onSubmit={handleIpCameraSubmit}>
              <input
                type="url"
                value={ipCameraUrl}
                onChange={(event) => setIpCameraUrl(event.target.value)}
                placeholder="http://phone-ip:8080/shot.jpg"
                className="ip-camera-input"
              />
              <button type="submit" className="ip-camera-apply">
                Use
              </button>
            </form>
          )}
        </div>

        {/* Video tile — slightly shorter on mobile so controls get room */}
        <div className="relative aspect-[4/3] w-full max-h-[48vh] overflow-hidden rounded-card bg-void-black animate-fade-up animate-delay-2 md:max-h-none">
          {cameraError ? (
            <div className="flex h-full w-full items-center justify-center px-24 text-center">
              <p className="font-telka text-body-sm font-light text-polished-white/90">
                {cameraError}
              </p>
            </div>
          ) : isIpCamera ? (
            <>
              {ipFrameUrl ? (
                <img
                  ref={ipImageRef}
                  src={ipFrameUrl}
                  alt=""
                  crossOrigin="anonymous"
                  onLoad={() => {
                    setIpCameraError(null);
                    syncVideoNode();
                  }}
                  onError={() => {
                    setIpCameraError("Could not load the phone camera snapshot.");
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-24 text-center">
                  <p className="font-telka text-body-sm font-light text-polished-white/70">
                    Waiting for phone camera
                  </p>
                </div>
              )}

              {systemReady && !faceReady && (
                <div className="scan-frame" aria-hidden="true" />
              )}
              {systemReady && faceReady && (
                <div className="scan-frame is-locked" aria-hidden="true" />
              )}

              <FaceOverlay box={displayBox} />
            </>
          ) : (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={mirrored}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: "user",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className="h-full w-full object-cover"
              />

              {systemReady && !faceReady && (
                <div className="scan-frame" aria-hidden="true" />
              )}
              {systemReady && faceReady && (
                <div className="scan-frame is-locked" aria-hidden="true" />
              )}

              <FaceOverlay box={displayBox} />
            </>
          )}
        </div>

        <div
          className="mt-16 flex min-h-[20px] items-center justify-center gap-8 px-8 animate-fade-up animate-delay-2 md:mt-24"
          role="status"
          aria-live="polite"
        >
          {helperTone === "loading" && (
            <span className="spinner" aria-hidden="true" />
          )}
          {helperTone === "ready" && (
            <span className="status-dot pulse text-void-black" />
          )}
          <p
            className={[
              "text-center font-telka text-body-sm font-light",
              helperTone === "error"
                ? "text-void-black/75"
                : helperTone === "ready"
                  ? "text-void-black"
                  : "text-void-black/65",
            ].join(" ")}
          >
            {helperText}
          </p>
        </div>
      </div>
    </section>
  );
});

export default CameraPanel;
