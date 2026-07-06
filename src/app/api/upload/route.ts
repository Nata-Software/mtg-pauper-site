import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  parseRankingCsv,
  parseRoundsCsv,
  replaceStoreData,
} from "@/lib/ingest";

export const runtime = "nodejs";

/**
 * Shared-password gate. When UPLOAD_PASSWORD is set (production), a matching
 * password is required. When it is unset (local dev), uploads are open.
 */
function passwordOk(provided: string): boolean {
  const expected = process.env.UPLOAD_PASSWORD;
  if (!expected) return true; // no gate configured (local dev)
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    if (!passwordOk(String(form.get("password") || ""))) {
      return NextResponse.json(
        { ok: false, error: "Wrong or missing upload password." },
        { status: 401 },
      );
    }

    const store = String(form.get("store") || "default").trim() || "default";

    const roundsFile = form.get("rounds");
    const rankingFile = form.get("ranking");

    const roundsCsv =
      roundsFile instanceof File ? await roundsFile.text() : null;
    const rankingCsv =
      rankingFile instanceof File ? await rankingFile.text() : null;

    if (!roundsCsv && !rankingCsv) {
      return NextResponse.json(
        { ok: false, error: "Send at least one CSV (rounds and/or ranking)." },
        { status: 400 },
      );
    }

    const matches = roundsCsv ? parseRoundsCsv(roundsCsv) : null;
    const standings = rankingCsv ? parseRankingCsv(rankingCsv) : null;

    const result = await replaceStoreData({ store, matches, standings });

    return NextResponse.json({ ok: true, store, ...result });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
