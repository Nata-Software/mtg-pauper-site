import type { NextRequest } from "next/server";
import { prisma } from "./prisma";

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limit, DB-backed (holds across serverless instances).
 * Returns whether the request is allowed and, if not, seconds until reset.
 * Approximate under heavy concurrency, which is fine for brute-force defense.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = new Date();
  const row = await prisma.rateLimit.findUnique({ where: { id: key } });

  // No window yet, or the window has expired -> start a fresh one.
  if (!row || now.getTime() - row.windowStart.getTime() > windowMs) {
    await prisma.rateLimit.upsert({
      where: { id: key },
      create: { id: key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (row.count >= limit) {
    const retryAfterSec = Math.ceil(
      (windowMs - (now.getTime() - row.windowStart.getTime())) / 1000,
    );
    return { allowed: false, retryAfterSec };
  }

  await prisma.rateLimit.update({
    where: { id: key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, retryAfterSec: 0 };
}

/** 20 attempts per 10 minutes per IP — generous for admins, kills brute-force. */
export async function limitAdmin(
  req: NextRequest,
  action: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  return checkRateLimit(`${action}:${clientIp(req)}`, 20, 10 * 60 * 1000);
}
