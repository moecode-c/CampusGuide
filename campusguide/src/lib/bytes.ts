const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1536 -> "1.5 KB". Returns an empty string for unknown sizes so callers can skip the label. */
export function formatBytes(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  // Raw bytes are always whole; everything above gets one decimal, so a 1.5 KB
  // file doesn't round to a misleading "2 KB".
  const digits = exponent === 0 ? 0 : 1;

  return `${value.toFixed(digits)} ${UNITS[exponent]}`;
}
