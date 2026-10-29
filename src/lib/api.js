import { normalizeApiBase } from "./apiBase.js";

const API_ROOT = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

export function photoImageProps(source) {
  const value = String(source || "");
  if (!value || /^(blob:|data:|https?:\/\/)/i.test(value)) return { src: value };
  const apiBase = new URL(API_ROOT, window.location.origin);
  const isMedicalApiPath = value.startsWith("/api/medicals/");
  const url = new URL(value, isMedicalApiPath ? apiBase.origin : window.location.origin);
  const usesAuthenticatedApi = isMedicalApiPath && url.origin === apiBase.origin;
  return { src: url.href, ...(usesAuthenticatedApi ? { crossOrigin: "use-credentials" } : {}) };
}

export class ApiError extends Error {
  constructor(message, status, code = "REQUEST_FAILED", details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    body,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json().catch(() => ({})) : {};
  if (!response.ok || payload.success === false) {
    const error = payload.error || {};
    throw new ApiError(error.message || `Request failed (${response.status}).`, response.status, error.code, error.details);
  }
  return payload.data ?? payload;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: "POST", body }),
  patch: (path, body) => apiRequest(path, { method: "PATCH", body }),
  delete: (path) => apiRequest(path, { method: "DELETE" })
};
