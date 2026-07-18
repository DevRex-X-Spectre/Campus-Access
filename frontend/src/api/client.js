/**
 * Thin API client for the Campus Access backend.
 * Base URL comes from VITE_API_URL — never hardcode localhost for production.
 */

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error(
      "Could not reach the server. Check your connection and that the API is running.",
    );
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
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    // FastAPI validation errors return detail as an array
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
      : String(detail);
    throw new Error(message);
  }

  return data;
}

export function getApiUrl() {
  return API_URL;
}

export function enrollFace({ name, image }) {
  return request("/enroll", {
    method: "POST",
    body: JSON.stringify({ name, image }),
  });
}

export function recognizeFace({ image }) {
  return request("/recognize", {
    method: "POST",
    body: JSON.stringify({ image }),
  });
}

export function fetchHealth() {
  return request("/health", { method: "GET" });
}
