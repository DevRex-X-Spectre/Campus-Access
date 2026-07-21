import { useCallback, useEffect, useRef, useState } from "react";
import { adminEnroll } from "../api/client";
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
 * Admin registration: Camera IP (rotated upright) and/or PC webcam.
 */
export default function AdminEnrollForm({ pin, defaultRole = "student", onDone }) {
  const videoRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("ip");
  const [activeIpUrl, setActiveIpUrl] = useState(
    () => localStorage.getItem("campus_ip_camera_url") || "",
  );
  const [rotation, setRotation] = useState(() => getSavedRotation());

  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [camError, setCamError] = useState(null);
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

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  const syncSource = useCallback(() => {
    sourceRef.current = isIp ? ipCanvasRef.current : videoRef.current;
  }, [isIp, ipCanvasRef]);

  const sourceReady = isIp ? ipReady : pcReady;
  const displayError = isIp ? ipError : camError;

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
    setCamError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setPcReady(true);
            syncSource();
          };
        }
      })
      .catch(() => {
        if (!cancelled) setCamError("Allow PC camera access, or switch to Camera IP.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [isIp, syncSource]);

  useEffect(() => {
    syncSource();
  }, [syncSource, ipReady, pcReady, mode, rotation]);

  const { detectorReady, displayBox, mediaBox } = useFaceDetection(sourceRef, {
    enabled: sourceReady && !displayError,
    mirrored,
    intervalMs: 120,
  });

  const handleIpConnect = useCallback((nextUrl) => {
    setCamError(null);
    setActiveIpUrl(nextUrl);
  }, []);

  const handleRotate = () => {
    const next = nextRotation(rotation);
    setRotation(next);
    saveRotation(next);
  };

  const submit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      setMessage(null);

      if (!name.trim()) {
        setMessage({ type: "error", text: "Enter the person’s full name." });
        return;
      }
      if (role === "student" && !matricNumber.trim()) {
        setMessage({ type: "error", text: "Enter the student’s matric number." });
        return;
      }

      setBusy(true);
      try {
        syncSource();
        const el = sourceRef.current;
        if (!isFaceSourceReady(el) || !mediaBox) {
          throw new Error(
            "No face detected. Tap Rotate until the face is upright, center it, then try again.",
          );
        }
        if (!detectorReady) {
          throw new Error("Face detector is still loading.");
        }
        const image = cropFaceToBase64(el, mediaBox);
        const result = await adminEnroll({
          name: name.trim(),
          role,
          image,
          matric_number: role === "student" ? matricNumber.trim() : null,
          pin,
        });
        setMessage({ type: "ok", text: result.message });
        setName("");
        setMatricNumber("");
        onDone?.();
      } catch (err) {
        setMessage({ type: "error", text: err.message || "Registration failed." });
      } finally {
        setBusy(false);
      }
    },
    [detectorReady, matricNumber, mediaBox, name, onDone, pin, role, syncSource],
  );

  let hint = "Center face for capture";
  if (displayError) hint = displayError;
  else if (isIp && !activeIpUrl) hint = "Connect Camera IP, then center the face";
  else if (!detectorReady) hint = "Preparing detector…";
  else if (mediaBox) hint = "Face ready — click Register face";
  else if (isIp) hint = "If sideways, tap Rotate until upright";

  return (
    <div className="admin-enroll">
      <div className="admin-enroll-grid">
        <div className="admin-enroll-left">
          <div className="gate-source-tabs admin-source-tabs" role="tablist" aria-label="Camera source">
            <button
              type="button"
              data-active={isIp}
              onClick={() => {
                setMode("ip");
                setCamError(null);
              }}
            >
              Camera IP
            </button>
            <button
              type="button"
              data-active={!isIp}
              onClick={() => {
                setMode("pc");
                setCamError(null);
              }}
            >
              PC camera
            </button>
          </div>

          {isIp && (
            <>
              <CameraIpConnect
                activeUrl={activeIpUrl}
                onConnect={handleIpConnect}
                disabled={busy}
              />
              <RotationControls
                rotation={rotation}
                onRotate={handleRotate}
                disabled={busy}
              />
            </>
          )}

          <div className="admin-enroll-cam">
            {displayError && !isIp ? (
              <div className="admin-enroll-empty">{displayError}</div>
            ) : isIp ? (
              activeIpUrl ? (
                <canvas ref={ipCanvasRef} className="admin-enroll-video" />
              ) : (
                <div className="admin-enroll-empty">Connect Camera IP to preview</div>
              )
            ) : (
              <video ref={videoRef} muted playsInline className="admin-enroll-video mirror" />
            )}

            {mediaBox && <FaceOverlay box={displayBox} />}
            <p className="admin-enroll-hint">{hint}</p>
          </div>
        </div>

        <div className="admin-enroll-fields">
          <label className="admin-field">
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ada Lovelace"
              autoComplete="name"
              disabled={busy}
            />
          </label>

          <label className="admin-field">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </label>

          {role === "student" && (
            <label className="admin-field">
              Matric number
              <input
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                placeholder="e.g. CSC/2021/001"
                autoComplete="off"
                disabled={busy}
              />
            </label>
          )}

          <button
            type="button"
            className="admin-btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Registering…" : "Register face"}
          </button>

          {message && (
            <p className={`admin-banner ${message.type === "ok" ? "ok" : "err"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
