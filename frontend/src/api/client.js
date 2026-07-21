/**
 * API client — VITE_API_URL is the backend base (no trailing slash).
 */

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

const ADMIN_PIN_KEY = "campus_access_admin_pin";
const DEFAULT_TIMEOUT_MS = 15000;

export function getApiUrl() {
  return API_URL;
}

export function getStoredAdminPin() {
  return sessionStorage.getItem(ADMIN_PIN_KEY) || "";
}

export function setStoredAdminPin(pin) {
  sessionStorage.setItem(ADMIN_PIN_KEY, pin);
}

export function clearStoredAdminPin() {
  sessionStorage.removeItem(ADMIN_PIN_KEY);
}

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        `Server timed out (${API_URL}). Is the backend running? Cold hosts can take a minute.`,
      );
    }
    throw new Error(
      `Could not reach the server at ${API_URL}. Start the backend and check VITE_API_URL.`,
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Request failed (${response.status})`;
    let message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
      : String(detail);

    if (response.status === 404) {
      message = `${message} — API ${path} not found on ${API_URL}. Restart the latest backend.`;
    }
    throw new Error(message);
  }

  return data;
}

function adminHeaders(pin) {
  return { "X-Admin-Pin": pin || getStoredAdminPin() };
}

export function getIpCameraSnapshotUrl(snapshotUrl) {
  const params = new URLSearchParams({ url: snapshotUrl });
  return `${API_URL}/ip-camera/snapshot?${params.toString()}`;
}

/** Check if a remembered Camera IP URL still works (from this PC). */
export function probeIpCamera(url) {
  const params = new URLSearchParams({ url });
  return request(`/ip-camera/probe?${params.toString()}`, {
    method: "GET",
    timeoutMs: 5000,
  });
}

/** Scan the LAN for IP Webcam phones (…:8080/shot.jpg). */
export function discoverIpCameras() {
  return request("/ip-camera/discover", {
    method: "GET",
    timeoutMs: 20000,
  });
}

export function fetchHealth() {
  return request("/health", { method: "GET" });
}

export function fetchAreas() {
  return request("/areas", { method: "GET" });
}

export function recognizeFace({ image, area_id }) {
  return request("/recognize", {
    method: "POST",
    body: JSON.stringify({ image, area_id }),
    timeoutMs: 30000,
  });
}

export function verifyAdminPin(pin) {
  return request("/admin/verify-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
    timeoutMs: 12000,
  });
}

export function adminEnroll({ name, role, image, matric_number, pin }) {
  return request("/admin/enroll", {
    method: "POST",
    headers: adminHeaders(pin),
    body: JSON.stringify({
      name,
      role,
      image,
      matric_number: matric_number || null,
    }),
    timeoutMs: 30000,
  });
}

export function adminListPersonnel({ role, pin } = {}) {
  const q = role ? `?role=${encodeURIComponent(role)}` : "";
  return request(`/admin/personnel${q}`, {
    method: "GET",
    headers: adminHeaders(pin),
  });
}

export function adminDeletePersonnel(id, pin) {
  return request(`/admin/personnel/${id}`, {
    method: "DELETE",
    headers: adminHeaders(pin),
  });
}

export function adminSetBlacklist(id, blacklisted, pin) {
  return request(`/admin/personnel/${id}/blacklist`, {
    method: "POST",
    headers: adminHeaders(pin),
    body: JSON.stringify({ blacklisted }),
  });
}

export function adminListAreas(pin) {
  return request("/admin/areas", {
    method: "GET",
    headers: adminHeaders(pin),
  });
}

export function adminCreateArea({ name, staff_only, pin }) {
  return request("/admin/areas", {
    method: "POST",
    headers: adminHeaders(pin),
    body: JSON.stringify({ name, staff_only }),
  });
}

export function adminUpdateArea(id, payload, pin) {
  return request(`/admin/areas/${id}`, {
    method: "PATCH",
    headers: adminHeaders(pin),
    body: JSON.stringify(payload),
  });
}

export function adminDeleteArea(id, pin) {
  return request(`/admin/areas/${id}`, {
    method: "DELETE",
    headers: adminHeaders(pin),
  });
}

export function adminListLogs(pin, limit = 40) {
  return request(`/admin/logs?limit=${limit}`, {
    method: "GET",
    headers: adminHeaders(pin),
  });
}
