import { timingSafeEqual } from "node:crypto";

/**
 * Shared-password check for admin actions. When UPLOAD_PASSWORD is set
 * (production) a matching password is required; when unset (local dev) the
 * action is open.
 */
export function uploadPasswordOk(provided: string): boolean {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected) return true;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
