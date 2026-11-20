import { NextRequest, NextResponse } from "next/server";
import { uploadPasswordOk } from "@/lib/auth";
import { limitAdmin } from "@/lib/ratelimit";
import {
  addManualSpot,
  awardOpenSpots,
  removeSpot,
} from "@/lib/mpl/spots";

export const runtime = "nodejs";

/**
 * Create and remove MPL Final spots.
 *
 * Same password as every other admin action (UPLOAD_PASSWORD), checked per
 * request — there is no session — and the same rate limit. Writes reach MplSpot
 * only; nothing here can touch the weekly matchup tables.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await limitAdmin(req, "mpl-spots");
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
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

    const action = String(form.get("action") || "").trim();

    if (action === "award") {
      const stageOrdinal = Number(form.get("stageOrdinal"));
      if (!Number.isInteger(stageOrdinal) || stageOrdinal < 1) {
        return NextResponse.json(
          { ok: false, error: "Choose which Open to award spots from." },
          { status: 400 },
        );
      }
      // Zero winners is legitimate: it clears a stage picked by mistake.
      const usernames = form.getAll("winner").map((v) => String(v));
      const result = await awardOpenSpots({ stageOrdinal, usernames });

      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "manual") {
      const result = await addManualSpot({
        player: String(form.get("player") || ""),
        source: String(form.get("source") || ""),
        date: String(form.get("date") || "") || null,
      });

      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "remove") {
      const id = Number(form.get("id"));
      if (!Number.isInteger(id)) {
        return NextResponse.json(
          { ok: false, error: "Missing which spot to remove." },
          { status: 400 },
        );
      }
      const result = await removeSpot(id);

      return NextResponse.json({ ok: true, action, ...result });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action "${action}".` },
      { status: 400 },
    );
  } catch (err) {
    console.error("mpl spots error", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
