/**
 * Guard against filing a tournament under the wrong weekly league.
 *
 * Re-importing is how decklist gaps get closed, and an import *replaces* that
 * tournament's rows — so picking the wrong league silently relabels a whole
 * event. That is how a Friday FNM ended up counted as a Tuesday night.
 *
 * The weekday is the check. It holds across the store's history: of 65 imported
 * tournaments, 64 sit on a day their league allows, and the one that doesn't is
 * exactly the mistake this exists to prevent.
 */

/** The store is in Brazil; a 20:00 event is "the next day" in UTC. */
const STORE_TIMEZONE = "America/Sao_Paulo";

/**
 * Days each league legitimately runs on.
 *
 * Tuesday also covers Wednesday: the CLM Etapa series runs midweek and is filed
 * under the Tuesday league (3 tournaments, deliberately).
 */
const LEAGUE_DAYS: Record<string, string[]> = {
  Tuesday: ["Tue", "Wed"],
  Friday: ["Fri"],
};

/** Weekday as the store experiences it, e.g. "Fri". */
export function storeWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
  }).format(date);
}

/** Full weekday name, for a message a human reads. */
export function storeWeekdayLong(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "long",
  }).format(date);
}

/** The league whose days include this one, if exactly one does. */
export function leagueForDate(date: Date): string | null {
  const day = storeWeekday(date);
  const hits = Object.entries(LEAGUE_DAYS).filter(([, days]) =>
    days.includes(day),
  );

  return hits.length === 1 ? hits[0][0] : null;
}

/**
 * Does this event's date fit the chosen league?
 *
 * A date with no league at all (a Saturday one-off) is a mismatch too — it
 * belongs to neither weekly league, so it should be a deliberate choice rather
 * than a slip. Events do move for holidays, so the caller offers an override
 * rather than making this final.
 */
export function checkLeagueDay(
  event: string,
  date: Date | null,
): { ok: true } | { ok: false; weekday: string; expected: string | null } {
  // No date scraped means nothing to check against; don't block the import.
  if (!date) return { ok: true };

  const allowed = LEAGUE_DAYS[event];
  if (!allowed) return { ok: true };

  if (allowed.includes(storeWeekday(date))) return { ok: true };

  return {
    ok: false,
    weekday: storeWeekdayLong(date),
    expected: leagueForDate(date),
  };
}
