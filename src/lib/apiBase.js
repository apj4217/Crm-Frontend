export function normalizeApiBase(value) {
  const base = String(value || "").trim().replace(/\/+$/, "");
  if (!base) return "/api";
  return /\/api$/i.test(base) ? base : `${base}/api`;
}
