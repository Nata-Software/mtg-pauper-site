import { NextRequest, NextResponse } from "next/server";
import { uploadPasswordOk } from "@/lib/auth";
import { limitAdmin } from "@/lib/ratelimit";
import { addTournamentData } from "@/lib/ingest";
import { scrapeTournament, scrapeMplStandings } from "@/lib/melee";
import { addMplOpen } from "@/lib/mpl/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Weekly leagues — these feed the matchup/metagame statistics. */
const EVENTS = new Set(["Tuesday", "Friday"]);

/**
 * The yearly league. Chosen from the same dropdown for convenience, but it takes
 * a completely separate path: standings-only scrape into the Mpl* tables, never
 * Match/Standing/Decklist. MPL games are not weekly-league games and must not be
 * counted as such.
 */
const MPL_EVENT = "MPL Open";

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
    if (event === MPL_EVENT) {
      const mpl = await scrapeMplStandings(url);

      // Stage number: the form pre-fills it from the melee name, but names like
      // "Super Pauper 30K" carry none, so an explicit value always wins.
      const typed = String(form.get("ordinal") || "").trim();
      const ordinal = typed ? Number(typed) : mpl.ordinal;
      if (!ordinal || !Number.isInteger(ordinal) || ordinal < 1) {
        return NextResponse.json(
          {
            ok: false,
            error: `Could not read a stage number from "${mpl.tournamentName}". Enter it manually.`,
          },
          { status: 400 },
        );
      }

      // Team events are guessed from the name (melee's standings don't expose
      // team size); the checkbox forces it on for one whose name doesn't say so.
      const isTeamEvent =
        mpl.isTeamEvent || String(form.get("teamEvent") || "") !== "";

      const result = await addMplOpen({
        ordinal,
        meleeId: mpl.tournamentId,
        name: mpl.tournamentName.trim(),
        date: mpl.date,
        isTeamEvent,
        results: mpl.results,
      });

      return NextResponse.json({
        ok: true,
        kind: "mpl",
        event,
        tournamentId: mpl.tournamentId,
        tournamentName: mpl.tournamentName.trim(),
        date: mpl.date ? mpl.date.toISOString().slice(0, 10) : null,
        ordinal: result.ordinal,
        results: result.results,
        replaced: result.replaced,
        isTeamEvent,
      });
    }

    if (!EVENTS.has(event)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Choose which league to add it to (Tuesday, Friday or MPL Open).",
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
