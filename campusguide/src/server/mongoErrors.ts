/**
 * MongoDB raises E11000 when a write violates a unique index. Without this the
 * route handler throws and the client sees an opaque 500 instead of a 409.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 11000 || code === 11001;
}
