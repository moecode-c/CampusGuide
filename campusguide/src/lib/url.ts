/**
 * Admins are allowed to type bare hosts like "drive.google.com". Rendering that
 * straight into an href makes the browser resolve it relative to the current
 * page ("/resources/drive.google.com"), so give it an explicit scheme.
 */
export function normalizeExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  // Block javascript:/data: style schemes from ever reaching an anchor href.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname.includes(".")) return null;

  return parsed.toString();
}
