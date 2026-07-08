/**
 * Parse the messy date values coming from the Google Sheet tabs.
 *
 * Two shapes appear in the source data:
 * - Excel/Sheets serial numbers (e.g. 45986) — used in the Ranking tab.
 * - Slash strings — used in the Rounds tabs. These are inconsistent:
 *   older rows are DD/MM/YYYY, newer rows are M/D/YYYY. We disambiguate by
 *   the parts (day > 12 or month > 12); when both are <= 12 it is genuinely
 *   ambiguous and we default to DD/MM/YYYY (the majority of the history).
 *
 * Returns a UTC Date at midnight, or null when unparseable.
 */
export function parseSheetDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  // Excel serial number (days since 1899-12-30).
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  // Pure numeric string -> treat as serial.
  if (/^\d+(\.\d+)?$/.test(s)) {
    return excelSerialToDate(Number(s));
  }

  // Slash / dash separated date.
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);

  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let year = Number(m[3]);

    // Handle a leading 4-digit year: YYYY/MM/DD
    if (String(m[1]).length === 4) {
      const y = a;
      return makeUTC(y, b, year); // a=year, b=month, third=day
    }

    if (year < 100) year += year < 70 ? 2000 : 1900;

    let day: number;
    let month: number;

    if (a > 12) {
      // first part must be the day -> DD/MM/YYYY
      day = a;
      month = b;
    } else if (b > 12) {
      // second part must be the day -> MM/DD/YYYY
      month = a;
      day = b;
    } else {
      // ambiguous: default to DD/MM/YYYY
      day = a;
      month = b;
    }

    return makeUTC(year, month, day);
  }

  // Last resort: let the engine try.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;

  // Excel epoch 1899-12-30 (accounts for the 1900 leap-year bug).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);

  return Number.isNaN(d.getTime()) ? null : d;
}

function makeUTC(year: number, month: number, day: number): Date | null {
  if (!year || !month || !day) return null;

  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

type Parts = { a: number; b: number; year: number } | null;

function splitSlash(s: string): Parts {
  const m = s.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);

  if (!m) return null;
  if (String(m[1]).length === 4) return null; // ISO-ish, unambiguous elsewhere

  let year = Number(m[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;

  return { a: Number(m[1]), b: Number(m[2]), year };
}

/**
 * Build a date parser that resolves the DD/MM vs MM/DD ambiguity using
 * context: the source data switched formats over time (older rows DD/MM,
 * newer rows M/D). For each year we vote using that year's *unambiguous*
 * dates (a part > 12 pins the format), then apply the winning orientation to
 * that year's ambiguous dates. Falls back to DD/MM when a year has no signal.
 */
export function buildDateResolver(
  rawValues: Iterable<unknown>,
): (v: unknown) => Date | null {
  const votes = new Map<number, { dmy: number; mdy: number }>();

  for (const raw of rawValues) {
    if (typeof raw === "number") continue;

    const p = splitSlash(String(raw ?? "").trim());
    if (!p) continue;

    const v = votes.get(p.year) ?? { dmy: 0, mdy: 0 };

    if (p.a > 12) v.dmy++; // first part must be day
    else if (p.b > 12) v.mdy++; // second part must be day

    votes.set(p.year, v);
  }

  const orientation = (year: number): "DMY" | "MDY" => {
    const v = votes.get(year);

    if (!v) return "DMY";

    return v.mdy > v.dmy ? "MDY" : "DMY";
  };

  return (raw: unknown): Date | null => {
    if (typeof raw === "number") return parseSheetDate(raw);

    const s = String(raw ?? "").trim();
    const p = splitSlash(s);

    if (!p) return parseSheetDate(raw); // serials, ISO, etc.

    let day: number;
    let month: number;

    if (p.a > 12) {
      day = p.a;
      month = p.b;
    } else if (p.b > 12) {
      month = p.a;
      day = p.b;
    } else if (orientation(p.year) === "MDY") {
      month = p.a;
      day = p.b;
    } else {
      day = p.a;
      month = p.b;
    }

    return makeUTC(p.year, month, day);
  };
}

/** yyyy-mm-dd for a Date (UTC), or "" for null. */
export function toISODate(d: Date | null | undefined): string {
  if (!d) return "";

  return d.toISOString().slice(0, 10);
}