import { useCallback, useEffect, useState } from "react";
import { discoverIpCameras, probeIpCamera } from "../api/client";

const IP_URL_KEY = "campus_ip_camera_url";

/**
 * Optimal Camera IP handling for gate + admin:
 *  1. Remember last URL and auto-connect if still online
 *  2. One-click “Find phone” LAN scan
 *  3. Manual URL still available as fallback
 */
export default function CameraIpConnect({
  activeUrl,
  onConnect,
  disabled = false,
}) {
  const [url, setUrl] = useState(
    () => activeUrl || localStorage.getItem(IP_URL_KEY) || "",
  );
  const [status, setStatus] = useState(""); // idle helper text
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState([]);

  const connect = useCallback(
    (nextUrl, { silent = false } = {}) => {
      const cleaned = (nextUrl || "").trim();
      if (!cleaned) {
        if (!silent) setStatus("Enter a camera link or tap Find phone.");
        return false;
      }
      localStorage.setItem(IP_URL_KEY, cleaned);
      setUrl(cleaned);
      onConnect(cleaned);
      if (!silent) setStatus("Connected.");
      return true;
    },
    [onConnect],
  );

  // Auto-reconnect remembered phone on mount
  useEffect(() => {
    let cancelled = false;
    const saved = (activeUrl || localStorage.getItem(IP_URL_KEY) || "").trim();
    if (!saved) {
      setStatus("Tap Find phone, or paste the camera link once.");
      return undefined;
    }

    setUrl(saved);
    setStatus("Checking saved phone camera…");
    setBusy(true);

    probeIpCamera(saved)
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          connect(saved, { silent: true });
          setStatus("Phone camera reconnected automatically.");
        } else {
          setStatus("Saved camera offline. Start IP Webcam, then Find phone.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("Could not reach saved camera. Start IP Webcam on the phone.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
    // Only on mount / when parent clears active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFind = async () => {
    setBusy(true);
    setFound([]);
    setStatus("Searching Wi‑Fi for your phone… (a few seconds)");
    try {
      const data = await discoverIpCameras();
      const cameras = data.cameras || [];
      setFound(cameras);
      if (!cameras.length) {
        setStatus(
          "No phone found. Same Wi‑Fi? IP Webcam server started? Then try again.",
        );
        return;
      }
      if (cameras.length === 1) {
        connect(cameras[0].url);
        setStatus(`Found and connected: ${cameras[0].host}`);
        return;
      }
      setStatus(`Found ${cameras.length} cameras — pick one below.`);
    } catch (err) {
      setStatus(err.message || "Search failed. Is the backend running on this PC?");
    } finally {
      setBusy(false);
    }
  };

  const handleManualConnect = (event) => {
    event.preventDefault();
    connect(url);
  };

  return (
    <div className="camera-ip-connect">
      <div className="gate-ip-form admin-ip-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Auto-filled when phone is found"
          className="gate-input"
          disabled={disabled || busy}
        />
        <button
          type="button"
          className="gate-btn-secondary"
          onClick={handleFind}
          disabled={disabled || busy}
        >
          {busy ? "…" : "Find phone"}
        </button>
        <button
          type="button"
          className="gate-btn-secondary gate-btn-quiet"
          onClick={handleManualConnect}
          disabled={disabled || busy}
        >
          Connect
        </button>
      </div>

      {found.length > 1 && (
        <div className="camera-ip-found">
          {found.map((cam) => (
            <button
              key={cam.url}
              type="button"
              className="camera-ip-found-item"
              onClick={() => {
                connect(cam.url);
                setStatus(`Connected: ${cam.host}`);
              }}
            >
              {cam.label || cam.url}
            </button>
          ))}
        </div>
      )}

      {status && (
        <p className="camera-ip-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

export { IP_URL_KEY };
