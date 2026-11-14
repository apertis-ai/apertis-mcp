/** Format a USD amount, or undefined when the gateway did not return one. */
export function usd(n: unknown, digits = 2): string | undefined {
  return typeof n === "number" && Number.isFinite(n)
    ? `$${n.toFixed(digits)}`
    : undefined;
}

/** Format a count, or undefined when absent. */
export function count(n: unknown): string | undefined {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US")
    : undefined;
}

/**
 * Format a timestamp the gateway returns as unix seconds (or an ISO string).
 * Zero, negative (-1 means "never expires"), or unparsable values yield undefined.
 */
export function when(v: unknown): string | undefined {
  let ms: number;
  if (typeof v === "number") {
    if (!(v > 0)) return undefined;
    ms = v < 1e12 ? v * 1000 : v;
  } else if (typeof v === "string" && v !== "") {
    ms = /^\d+$/.test(v) ? Number(v) * (v.length <= 10 ? 1000 : 1) : Date.parse(v);
  } else {
    return undefined;
  }
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** Render `label: value` lines, dropping fields whose value is undefined. */
export function lines(entries: Array<[string, string | undefined]>): string[] {
  return entries
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `  ${k}: ${v}`);
}
