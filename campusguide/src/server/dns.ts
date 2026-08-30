import dns from "node:dns";

/**
 * Makes `mongodb+srv://` URIs resolvable on networks whose resolver refuses
 * SRV lookups.
 *
 * An Atlas SRV URI needs an SRV record and a TXT record before the driver knows
 * which hosts to dial. On this machine the system resolver answers both with
 * ECONNREFUSED, so the connection fails before a single packet reaches Atlas.
 *
 * Public resolvers are appended after the system ones rather than replacing
 * them: local names (a LAN Mongo, a corporate host) keep resolving through the
 * normal resolver, and c-ares falls through to the public servers only when the
 * first ones fail.
 *
 * Override with DNS_SERVERS="1.1.1.1,9.9.9.9" if these are blocked too.
 */

const FALLBACK_RESOLVERS = ["8.8.8.8", "1.1.1.1"];

let applied = false;

export function ensureSrvDns(uri?: string) {
  // Only SRV URIs need this; a plain mongodb:// host resolves normally.
  if (applied || !uri?.startsWith("mongodb+srv://")) return;
  applied = true;

  const configured = process.env.DNS_SERVERS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbacks = configured?.length ? configured : FALLBACK_RESOLVERS;

  try {
    const current = dns.getServers();
    const merged = [...current, ...fallbacks.filter((s) => !current.includes(s))];
    dns.setServers(merged);
  } catch (err) {
    // A bad DNS_SERVERS value must not take the app down — the driver will
    // still try the system resolver and report its own error if that fails.
    console.error("could not set DNS fallbacks", err);
  }
}
