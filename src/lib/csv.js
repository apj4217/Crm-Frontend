/** Quote a cell and neutralize spreadsheet formula prefixes in untrusted text. */
export function escapeCsvCell(value) {
  const raw = String(value ?? "");
  const startsLikeFormula = typeof value !== "number" && /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(raw);
  const safe = startsLikeFormula ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
