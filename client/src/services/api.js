const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";
const TOKEN_KEY = "promo_token";

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, { method = "GET", body, skipAuth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (!skipAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Please check your connection.");
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const err = (payload && payload.error) || {};
    throw new ApiError(res.status, err.code || "UNKNOWN_ERROR", err.message || "Something went wrong.", err.data);
  }

  return payload;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body, opts) => apiFetch(path, { method: "POST", body, ...opts }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body }),
  delete: (path) => apiFetch(path, { method: "DELETE" }),
};

export default api;
