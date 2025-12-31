import crypto from "crypto";

function normalizeIfNoneMatch(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function jsonWithEtag(req: Request, body: unknown, opts?: { status?: number; cacheControl?: string }) {
  const json = JSON.stringify(body);
  const etag = `"${crypto.createHash("sha1").update(json).digest("base64")}"`;

  const cacheControl = opts?.cacheControl ?? "private, max-age=0, must-revalidate";

  const inm = normalizeIfNoneMatch(req.headers.get("if-none-match"));
  const headers: Record<string, string> = {
    etag,
    "cache-control": cacheControl,
    vary: "cookie",
  };

  if (inm.includes(etag) || inm.includes("*")) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(json, {
    status: opts?.status ?? 200,
    headers: {
      ...headers,
      "content-type": "application/json",
    },
  });
}

export function noStoreJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
