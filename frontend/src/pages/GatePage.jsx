import { useCallback, useEffect, useRef, useState } from "react";
import GateCamera from "../components/GateCamera";
import { fetchAreas, getApiUrl, recognizeFace } from "../api/client";

const AREA_KEY = "campus_gate_area_id";

/**
 * Gate kiosk:
 * - Camera IP live feed
 * - Auto-scan when a face is locked (no button)
 * - Shows granted / denied with reason
 * - Re-arms when the face leaves so the next person is scanned immediately
 */
export default function GatePage() {
  const cameraRef = useRef(null);
  const scanningRef = useRef(false);
  const armedRef = useRef(true);
  const areaIdRef = useRef(null);

  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState(() => {
    const saved = localStorage.getItem(AREA_KEY);
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [areasError, setAreasError] = useState(null);
  const [result, setResult] = useState(null);
  const [statusLine, setStatusLine] = useState("Ready for the next person");

  areaIdRef.current = areaId;

  useEffect(() => {
    let cancelled = false;
    fetchAreas()
      .then((data) => {
        if (cancelled) return;
        const list = data.areas || [];
        setAreas(list);
        setAreasError(null);
        if (!list.length) {
          setAreasError("No areas on the server. Open Admin and create areas, or restart the backend.");
          return;
        }
        const saved = Number(localStorage.getItem(AREA_KEY));
        const exists = list.some((a) => a.id === saved);
        const next = exists ? saved : list[0].id;
        setAreaId(next);
        localStorage.setItem(AREA_KEY, String(next));
      })
      .catch((err) => {
        if (!cancelled) {
          setAreasError(
            err.message ||
              `Could not load areas from ${getApiUrl()}. Start the local backend.`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onAreaChange = (id) => {
    const num = Number(id);
    setAreaId(num);
    localStorage.setItem(AREA_KEY, String(num));
    setResult(null);
    armedRef.current = true;
    setStatusLine("Ready for the next person");
  };

  const runScan = useCallback(async () => {
    if (scanningRef.current) return;
    const currentArea = areaIdRef.current;
    if (!currentArea) {
      setResult({
        granted: false,
        title: "Access denied",
        reason: "Select an area before scanning.",
      });
      return;
    }

    scanningRef.current = true;
    armedRef.current = false;
    setLoading(true);
    setStatusLine("Verifying identity…");

    try {
      const image = await cameraRef.current.captureFace();
      const data = await recognizeFace({ image, area_id: currentArea });
      setResult({
        granted: Boolean(data.granted),
        title: data.granted ? "Access granted" : "Access denied",
        reason: data.reason || data.message,
        name: data.name,
        role: data.role,
        matric: data.matric_number,
        area: data.area_name,
      });
      setStatusLine("Step away for the next person");
    } catch (err) {
      setResult({
        granted: false,
        title: "Access denied",
        reason: err?.message || "Scan failed.",
      });
      setStatusLine("Step away, then try again");
    } finally {
      setLoading(false);
      scanningRef.current = false;
      // Stay disarmed until face leaves (handled in onFacePresenceChange)
    }
  }, []);

  const onFacePresenceChange = useCallback(
    (present) => {
      if (!present) {
        // Face left the frame — re-arm immediately for the next person
        if (!scanningRef.current) {
          armedRef.current = true;
          setStatusLine("Ready for the next person");
        }
        return;
      }

      // Face locked in frame
      if (!armedRef.current || scanningRef.current) return;
      if (!areaIdRef.current) return;

      // Small settle delay so the crop is stable, then scan once
      window.setTimeout(() => {
        if (!armedRef.current || scanningRef.current) return;
        if (!cameraRef.current?.hasFace?.()) return;
        runScan();
      }, 180);
    },
    [runScan],
  );

  const selectedArea = areas.find((a) => a.id === areaId) || null;

  return (
    <div className="gate-page">
      <header className="gate-top">
        <div>
          <p className="gate-kicker">Campus Access</p>
          <h1 className="gate-title">Entry gate</h1>
        </div>
        <a className="gate-admin-link" href="/admin">
          Admin
        </a>
      </header>

      <main className="gate-main">
        <section className="gate-left">
          <label className="gate-label">
            Area
            <select
              className="gate-select"
              value={areaId ?? ""}
              onChange={(e) => onAreaChange(e.target.value)}
              disabled={!areas.length}
            >
              {!areas.length && <option value="">No areas configured</option>}
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                  {area.staff_only ? " · Staff only" : ""}
                </option>
              ))}
            </select>
          </label>

          {selectedArea?.staff_only && (
            <p className="gate-area-note">This area is restricted to staff.</p>
          )}
          {areasError && <p className="gate-area-error">{areasError}</p>}

          <GateCamera ref={cameraRef} onFacePresenceChange={onFacePresenceChange} />

          <p className="gate-auto-status" role="status">
            {loading ? "Scanning…" : statusLine}
          </p>
        </section>

        <section className="gate-right" aria-live="polite">
          {!result ? (
            <div className="gate-result idle">
              <p className="gate-result-kicker">Live gate</p>
              <h2 className="gate-result-title">Ready</h2>
              <p className="gate-result-reason">
                Connect Camera IP. When a face is detected, access is decided automatically.
              </p>
            </div>
          ) : (
            <div className={`gate-result ${result.granted ? "ok" : "deny"}`}>
              <p className="gate-result-kicker">
                {result.area ? result.area : "Gate decision"}
              </p>
              <h2 className="gate-result-title">{result.title}</h2>
              <p className="gate-result-reason">{result.reason}</p>
              {(result.name || result.role || result.matric) && (
                <p className="gate-result-meta">
                  {[result.name, result.matric, result.role].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
