import { NextRequest, NextResponse } from "next/server";
import { uploadPasswordOk } from "@/lib/auth";
import { limitAdmin } from "@/lib/ratelimit";
import { addTournamentData } from "@/lib/ingest";
import { scrapeTournament } from "@/lib/melee";

export const runtime = "nodejs";
export const maxDuration = 60;

const EVENTS = new Set(["Tuesday", "Friday"]);

export async function POST(req: NextRequest) {
  try {
    const rl = await limitAdmin(req, "scrape");
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
        { ok: false, error: "Wrong or missing password." },
        { status: 401 },
      );
    }

    const url = String(form.get("url") || "").trim();
    const event = String(form.get("event") || "").trim();
    const store = String(form.get("store") || "default").trim() || "default";

    if (!url) {
      return NextResponse.json(
        { ok: false, error: "Paste a melee.gg tournament URL." },
        { status: 400 },
      );
    }
    if (!EVENTS.has(event)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Choose which league to add it to (Tuesday or Friday).",
        },
        { status: 400 },
      );
    }

    const scraped = await scrapeTournament(url);
    if (scraped.matches.length === 0 && scraped.standings.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No matches or standings found for that tournament.",
        },
        { status: 400 },
      );
    }

    const result = await addTournamentData({
      store,
      event,
      tournamentId: scraped.tournamentId,
      tournamentName: scraped.tournamentName,
      date: scraped.date,
      matches: scraped.matches,
      standings: scraped.standings,
      decklists: scraped.decklists,
    });

    return NextResponse.json({
      ok: true,
      kind: "scrape",
      event,
      tournamentId: scraped.tournamentId,
      tournamentName: scraped.tournamentName,
      date: scraped.date ? scraped.date.toISOString().slice(0, 10) : null,
      warnings: scraped.warnings,
      ...result,
    });
  } catch (err) {
    console.error("scrape error", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
