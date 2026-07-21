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
 * Admin registration — Camera IP only (phone IP Webcam).
 */
export default function AdminEnrollForm({ pin, defaultRole = "student", onDone }) {
  const sourceRef = useRef(null);

  const [activeIpUrl, setActiveIpUrl] = useState(
    () => localStorage.getItem("campus_ip_camera_url") || "",
  );
  const [rotation, setRotation] = useState(() => getSavedRotation());

  const [name, setName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const {
    canvasRef: ipCanvasRef,
    frameReady: ipReady,
    error: ipError,
  } = useIpCameraStream(activeIpUrl, rotation, {
    enabled: Boolean(activeIpUrl),
  });

  const cameraOnline = Boolean(activeIpUrl && ipReady && !ipError);

  useEffect(() => {
    setRole(defaultRole);
  }, [defaultRole]);

  const syncSource = useCallback(() => {
    sourceRef.current = ipCanvasRef.current;
  }, [ipCanvasRef]);

  useEffect(() => {
    syncSource();
  }, [syncSource, ipReady, rotation]);

  const { detectorReady, displayBox, mediaBox } = useFaceDetection(sourceRef, {
    enabled: cameraOnline,
    mirrored: false,
    intervalMs: 120,
  });

  const handleIpConnect = useCallback((nextUrl) => {
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
  if (!activeIpUrl) hint = "Connect Camera IP, then center the face";
  else if (ipError) hint = ipError;
  else if (!detectorReady) hint = "Preparing detector…";
  else if (mediaBox) hint = "Face ready — click Register face";
  else hint = "If sideways, tap Rotate until upright";

  return (
    <div className="admin-enroll">
      <div className="admin-enroll-grid">
        <div className="admin-enroll-left">
          <div className="camera-status-row">
            <span
              className={`status-dot-lg ${cameraOnline ? "status-online" : "status-offline"}`}
            />
            <span className="camera-status-label">
              {cameraOnline ? "Camera online" : "Camera offline"}
            </span>
          </div>

          <CameraIpConnect
            activeUrl={activeIpUrl}
            onConnect={handleIpConnect}
            disabled={busy}
          />
          <RotationControls rotation={rotation} onRotate={handleRotate} disabled={busy} />

          <div className={`admin-enroll-cam ${cameraOnline ? "is-online" : "is-offline"}`}>
            {activeIpUrl ? (
              <canvas ref={ipCanvasRef} className="admin-enroll-video" />
            ) : (
              <div className="admin-enroll-empty">Connect Camera IP to preview</div>
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
