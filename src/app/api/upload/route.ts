import { NextRequest, NextResponse } from "next/server";
import { uploadPasswordOk } from "@/lib/auth";
import { limitAdmin } from "@/lib/ratelimit";
import {
  getTournamentDataCounts,
  parseRankingCsv,
  parseRoundsCsv,
  replaceStoreData,
  replaceTournamentData,
  validateSingleTournamentData,
} from "@/lib/ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rl = await limitAdmin(req, "upload");
    if (!rl.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many attempts. Try again in ${rl.retryAfterSec}s.`,
        },
        { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
      );
    }

    const form = await req.formData();

    if (!uploadPasswordOk(String(form.get("password") || ""))) {
      return NextResponse.json(
        { ok: false, error: "Wrong or missing upload password." },
        { status: 401 },
      );
    }

    const store = String(form.get("store") || "default").trim() || "default";
    const mode = form.get("mode") === "tournament" ? "tournament" : "bulk";
    const tournamentId = String(form.get("tournamentId") || "").trim();

    if (mode === "tournament" && !tournamentId) {
      return NextResponse.json(
        { ok: false, error: "Tournament ID is required." },
        { status: 400 },
      );
    }

    if (mode === "bulk" && form.get("confirmed") !== "true") {
      return NextResponse.json(
        {
          ok: false,
          error: "Bulk replacement must be explicitly confirmed.",
        },
        { status: 400 },
      );
    }

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

    if (mode === "tournament") {
      const tournamentName = validateSingleTournamentData({
        matches,
        standings,
      });
      const previous = await getTournamentDataCounts({ store, tournamentId });

      if (form.get("confirmed") !== "true") {
        return NextResponse.json({
          ok: true,
          kind: "upload-check",
          store,
          tournamentId,
          tournamentName,
          ...previous,
        });
      }

      const result = await replaceTournamentData({
        store,
        tournamentId,
        tournamentName,
        matches,
        standings,
      });

      return NextResponse.json({
        ok: true,
        kind: "tournament-upload",
        store,
        tournamentId,
        tournamentName,
        replaced: previous.exists,
        ...result,
      });
    }

    const result = await replaceStoreData({ store, matches, standings });

    return NextResponse.json({ ok: true, kind: "upload", store, ...result });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
