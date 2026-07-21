import { useCallback, useEffect, useMemo, useState } from "react";
import AdminEnrollForm from "../components/AdminEnrollForm";
import {
  adminCreateArea,
  adminDeleteArea,
  adminDeletePersonnel,
  adminListAreas,
  adminListLogs,
  adminListPersonnel,
  adminSetBlacklist,
  adminUpdateArea,
  clearStoredAdminPin,
  getApiUrl,
  getStoredAdminPin,
  setStoredAdminPin,
  verifyAdminPin,
} from "../api/client";

const TABS = [
  { id: "students", label: "Students" },
  { id: "staff", label: "Staff" },
  { id: "register", label: "Register" },
  { id: "areas", label: "Areas" },
  { id: "logs", label: "Activity" },
];

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authedPin, setAuthedPin] = useState(() => getStoredAdminPin());
  const [pinError, setPinError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  const [tab, setTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [areas, setAreas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaStaffOnly, setNewAreaStaffOnly] = useState(false);

  const unlocked = Boolean(authedPin);

  const refresh = useCallback(async () => {
    if (!authedPin) return;
    setLoading(true);
    setFlash(null);
    try {
      const [s, st, a, l] = await Promise.all([
        adminListPersonnel({ role: "student", pin: authedPin }),
        adminListPersonnel({ role: "staff", pin: authedPin }),
        adminListAreas(authedPin),
        adminListLogs(authedPin, 40),
      ]);
      setStudents(s.personnel || []);
      setStaff(st.personnel || []);
      setAreas(a.areas || []);
      setLogs(l.logs || []);
    } catch (err) {
      if ((err.message || "").toLowerCase().includes("invalid admin pin")) {
        clearStoredAdminPin();
        setAuthedPin("");
        setPinError("Session expired. Enter PIN again.");
      } else {
        setFlash({ type: "err", text: err.message || "Failed to load admin data." });
      }
    } finally {
      setLoading(false);
    }
  }, [authedPin]);

  useEffect(() => {
    if (unlocked) refresh();
  }, [unlocked, refresh]);

  const handleUnlock = async (event) => {
    event.preventDefault();
    setPinError(null);
    setUnlocking(true);
    try {
      const entered = pin.trim();
      if (!entered) {
        setPinError("Enter the admin PIN.");
        return;
      }
      await verifyAdminPin(entered);
      setStoredAdminPin(entered);
      setAuthedPin(entered);
      setPin("");
    } catch (err) {
      // Surface real API failures (wrong host, 404, timeout) instead of spinning forever
      setPinError(err.message || "Invalid PIN or server unreachable.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = () => {
    clearStoredAdminPin();
    setAuthedPin("");
    setStudents([]);
    setStaff([]);
    setAreas([]);
    setLogs([]);
  };

  const onDelete = async (person) => {
    if (!window.confirm(`Delete ${person.name}? This cannot be undone.`)) return;
    try {
      await adminDeletePersonnel(person.id, authedPin);
      setFlash({ type: "ok", text: `${person.name} deleted.` });
      refresh();
    } catch (err) {
      setFlash({ type: "err", text: err.message });
    }
  };

  const onBlacklist = async (person) => {
    const next = !person.blacklisted;
    try {
      const res = await adminSetBlacklist(person.id, next, authedPin);
      setFlash({ type: "ok", text: res.message });
      refresh();
    } catch (err) {
      setFlash({ type: "err", text: err.message });
    }
  };

  const onCreateArea = async (event) => {
    event.preventDefault();
    if (!newAreaName.trim()) return;
    try {
      await adminCreateArea({
        name: newAreaName.trim(),
        staff_only: newAreaStaffOnly,
        pin: authedPin,
      });
      setNewAreaName("");
      setNewAreaStaffOnly(false);
      setFlash({ type: "ok", text: "Area created." });
      refresh();
    } catch (err) {
      setFlash({ type: "err", text: err.message });
    }
  };

  const onToggleAreaStaff = async (area) => {
    try {
      await adminUpdateArea(area.id, { staff_only: !area.staff_only }, authedPin);
      refresh();
    } catch (err) {
      setFlash({ type: "err", text: err.message });
    }
  };

  const onDeleteArea = async (area) => {
    if (!window.confirm(`Delete area “${area.name}”?`)) return;
    try {
      await adminDeleteArea(area.id, authedPin);
      setFlash({ type: "ok", text: "Area deleted." });
      refresh();
    } catch (err) {
      setFlash({ type: "err", text: err.message });
    }
  };

  const stats = useMemo(
    () => ({
      students: students.length,
      staff: staff.length,
      blacklisted:
        students.filter((p) => p.blacklisted).length +
        staff.filter((p) => p.blacklisted).length,
      staffAreas: areas.filter((a) => a.staff_only).length,
    }),
    [students, staff, areas],
  );

  if (!unlocked) {
    return (
      <div className="admin-lock">
        <div className="admin-lock-card">
          <p className="admin-lock-kicker">Campus Access</p>
          <h1>Admin</h1>
          <p className="admin-lock-copy">
            Enter the admin PIN to manage registrations, areas, and access policy.
          </p>
          <form onSubmit={handleUnlock} className="admin-lock-form">
            <label>
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={32}
              />
            </label>
            {pinError && <p className="admin-banner err">{pinError}</p>}
            <button type="submit" className="admin-btn-primary" disabled={unlocking}>
              {unlocking ? "Checking…" : "Unlock"}
            </button>
          </form>
          <p className="admin-api-hint">API: {getApiUrl()}</p>
          <a href="/" className="admin-back">
            ← Back to gate
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <p className="admin-lock-kicker">Campus Access</p>
          <h1>Admin</h1>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-side-foot">
          <button type="button" className="admin-btn-ghost" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={handleLock}>
            Lock
          </button>
          <a href="/" className="admin-back">
            ← Gate
          </a>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h2>
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <p className="admin-sub">
              Register people, control staff-only areas, and review gate decisions.
            </p>
          </div>
          <div className="admin-stats">
            <div>
              <strong>{stats.students}</strong>
              <span>Students</span>
            </div>
            <div>
              <strong>{stats.staff}</strong>
              <span>Staff</span>
            </div>
            <div>
              <strong>{stats.blacklisted}</strong>
              <span>Blacklisted</span>
            </div>
            <div>
              <strong>{stats.staffAreas}</strong>
              <span>Staff areas</span>
            </div>
          </div>
        </header>

        {flash && (
          <p className={`admin-banner ${flash.type === "ok" ? "ok" : "err"}`}>{flash.text}</p>
        )}

        {tab === "students" && (
          <PeopleTable
            title="Students"
            people={students}
            onDelete={onDelete}
            onBlacklist={onBlacklist}
            empty="No students registered yet."
            showMatric
          />
        )}

        {tab === "staff" && (
          <PeopleTable
            title="Staff"
            people={staff}
            onDelete={onDelete}
            onBlacklist={onBlacklist}
            empty="No staff registered yet."
          />
        )}

        {tab === "register" && (
          <section className="admin-card">
            <h3>Register a person</h3>
            <p className="admin-card-copy">
              Capture with <strong>Camera IP</strong> (phone IP Webcam) or <strong>PC camera</strong>.
              Choose Student or Staff — that role controls staff-only areas at the gate.
            </p>
            <AdminEnrollForm
              pin={authedPin}
              defaultRole="student"
              onDone={refresh}
            />
          </section>
        )}

        {tab === "areas" && (
          <section className="admin-card">
            <h3>Areas</h3>
            <p className="admin-card-copy">
              Staff-only areas deny students with a clear reason. Open areas allow both
              students and staff.
            </p>

            <form className="admin-area-form" onSubmit={onCreateArea}>
              <input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Area name"
              />
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={newAreaStaffOnly}
                  onChange={(e) => setNewAreaStaffOnly(e.target.checked)}
                />
                Staff only
              </label>
              <button type="submit" className="admin-btn-primary">
                Add area
              </button>
            </form>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Access</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <tr key={area.id}>
                      <td>{area.name}</td>
                      <td>
                        <button
                          type="button"
                          className={`admin-pill ${area.staff_only ? "warn" : "ok"}`}
                          onClick={() => onToggleAreaStaff(area)}
                        >
                          {area.staff_only ? "Staff only" : "Open"}
                        </button>
                      </td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="admin-link-danger"
                          onClick={() => onDeleteArea(area)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!areas.length && (
                    <tr>
                      <td colSpan={3} className="admin-empty">
                        No areas yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "logs" && (
          <section className="admin-card">
            <h3>Recent gate activity</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Result</th>
                    <th>Person</th>
                    <th>Area</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`admin-pill ${log.granted ? "ok" : "warn"}`}>
                          {log.granted ? "Granted" : "Denied"}
                        </span>
                      </td>
                      <td>
                        {log.person_name
                          ? `${log.person_name}${log.person_role ? ` (${log.person_role})` : ""}`
                          : "—"}
                      </td>
                      <td>{log.area_name || "—"}</td>
                      <td className="admin-reason">{log.reason}</td>
                    </tr>
                  ))}
                  {!logs.length && (
                    <tr>
                      <td colSpan={5} className="admin-empty">
                        No scans yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PeopleTable({ title, people, onDelete, onBlacklist, empty, showMatric = false }) {
  const cols = showMatric ? 6 : 5;
  return (
    <section className="admin-card">
      <h3>{title}</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              {showMatric && <th>Matric no.</th>}
              <th>Samples</th>
              <th>Status</th>
              <th>Registered</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id} className={person.blacklisted ? "is-blocked" : ""}>
                <td>{person.name}</td>
                {showMatric && (
                  <td className="admin-mono">{person.matric_number || "—"}</td>
                )}
                <td>{person.embedding_count}</td>
                <td>
                  <span className={`admin-pill ${person.blacklisted ? "warn" : "ok"}`}>
                    {person.blacklisted ? "Blacklisted" : "Active"}
                  </span>
                </td>
                <td className="admin-mono">
                  {new Date(person.created_at).toLocaleDateString()}
                </td>
                <td className="admin-actions">
                  <button type="button" onClick={() => onBlacklist(person)}>
                    {person.blacklisted ? "Unblock" : "Blacklist"}
                  </button>
                  <button
                    type="button"
                    className="admin-link-danger"
                    onClick={() => onDelete(person)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!people.length && (
              <tr>
                <td colSpan={cols} className="admin-empty">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
