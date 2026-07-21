const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const HUB_URL =
  "https://melee.gg/Hub/Organization/2833#hub-tournaments-table-label";

const ORGANIZATION_TOURNAMENTS_URL =
  "https://melee.gg/Hub/OrganizationTournaments/2833";

const SEARCH_ORGANIZATION_TOURNAMENTS_URL =
  "https://melee.gg/Hub/SearchOrganizationTournaments/2833";

const TIME_ZONE = "America/Sao_Paulo";

export type NextTournament = {
  date: string;
  time: string;
  name: string;
  game: string;
  players: number;
  playerCap?: number;
  format?: string;
  imageUrl?: string;
  url?: string;
};

type RawTournamentRow = {
  id: string | undefined;
  startDate: string;
  name: string;
  game: string;
  players: string;
  playerCap: string;
  format: string | undefined;
  imageUrl: string | undefined;
  url: string | undefined;
};

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCell(value: unknown): string {
  return decodeHtml(stripTags(String(value ?? "")));
}

function parseNumber(value: string): number | undefined {
  const match = value.match(/\d+/);

  return match ? Number(match[0]) : undefined;
}

function parsePlayerCount(value: string): number {
  return parseNumber(value) ?? 0;
}

function extractTournamentUrl(value: unknown): string | undefined {
  const raw = String(value ?? "");
  const match = raw.match(
    /href=["']([^"']*\/Tournament\/View\/\d+[^"']*)["']/i,
  );

  if (!match) return undefined;

  const href = decodeHtml(match[1]);

  if (href.startsWith("http")) return href;

  return `https://melee.gg${href.startsWith("/") ? "" : "/"}${href}`;
}

function tournamentUrlFromId(id: unknown): string | undefined {
  const value = String(id ?? "").trim();

  if (!value) return undefined;

  return `https://melee.gg/Tournament/View/${value}`;
}

function saoPauloParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function parseMeleeStartDate(value: string): {
  date: string;
  time: string;
  timestamp: number;
} | null {
  const trimmed = value.trim();

  const isoParsed = Date.parse(trimmed);

  if (!Number.isNaN(isoParsed)) {
    const parts = saoPauloParts(new Date(isoParsed));

    return {
      ...parts,
      timestamp: isoParsed,
    };
  }

  const match = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)(?:\s+([+-]\d{2}))?/i,
  );

  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const ampm = match[6].toUpperCase();
  const offset = match[7] ?? "-03";

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  const date = `${year}-${String(month).padStart(2, "0")}-${String(
    day,
  ).padStart(2, "0")}`;

  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}`;

  const timestamp = Date.parse(`${date}T${time}:00${offset}:00`);

  return {
    date,
    time,
    timestamp: Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp,
  };
}

function todayStartInSaoPaulo(now: Date): number {
  const parts = saoPauloParts(now);
  return Date.parse(`${parts.date}T00:00:00-03:00`);
}

function isTodayOrLater(event: NextTournament, now: Date): boolean {
  return (
    Date.parse(`${event.date}T${event.time}:00-03:00`) >=
    todayStartInSaoPaulo(now)
  );
}

function sortTournaments(a: NextTournament, b: NextTournament): number {
  const aTime = Date.parse(`${a.date}T${a.time}:00-03:00`);
  const bTime = Date.parse(`${b.date}T${b.time}:00-03:00`);

  if (aTime !== bTime) return aTime - bTime;
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.time !== b.time) return a.time.localeCompare(b.time);

  return a.name.localeCompare(b.name);
}

function toTournament(row: RawTournamentRow): NextTournament | null {
  const parsedDate = parseMeleeStartDate(row.startDate);

  if (!parsedDate || !row.name) return null;

  return {
    date: parsedDate.date,
    time: parsedDate.time,
    name: row.name,
    game: row.game,
    players: parsePlayerCount(row.players),
    playerCap: parseNumber(row.playerCap),
    format: row.format,
    imageUrl: row.imageUrl,
    url: row.url,
  };
}

function rawRowsFromArrayRows(rows: unknown[]): RawTournamentRow[] {
  return rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => {
      const id = cleanCell(row[9] ?? "");
      const nameHtml = row[1];

      return {
        id,
        startDate: cleanCell(row[0]),
        name: cleanCell(nameHtml),
        game: cleanCell(row[2]),
        players: cleanCell(row[5]),
        playerCap: "",
        format: undefined,
        imageUrl: undefined,
        url: extractTournamentUrl(nameHtml) ?? tournamentUrlFromId(id),
      };
    })
    .filter((row) => row.startDate && row.name);
}

function rawRowsFromObjectRows(
  rows: Record<string, unknown>[],
): RawTournamentRow[] {
  return rows
    .map((row) => {
      const id = cleanCell(row.ID ?? row.Id ?? row.id ?? "");

      const name =
        row.Name ?? row.name ?? row.TournamentName ?? row.tournamentName ?? "";

      const format = cleanCell(row.Formats ?? row.formats ?? "");

      const game =
        row.GameDescription ??
        row.gameDescription ??
        row.Game ??
        row.game ??
        format ??
        "";

      const players =
        row.ParticipatingCount ??
        row.PlayerCount ??
        row.RegisteredPlayers ??
        row.Players ??
        row.players ??
        0;

      const playerCap = row.PlayerCap ?? row.playerCap ?? "";

      const imageUrl = cleanCell(
        row.BrandImageSource ??
          row.brandImageSource ??
          row.ImageUrl ??
          row.imageUrl ??
          "",
      );

      return {
        id,
        startDate: cleanCell(row.StartDate ?? row.startDate ?? row.Date ?? ""),
        name: cleanCell(name),
        game: cleanCell(game),
        players: cleanCell(players),
        playerCap: cleanCell(playerCap),
        format: format || undefined,
        imageUrl: imageUrl || undefined,
        url: extractTournamentUrl(name) ?? tournamentUrlFromId(id),
      };
    })
    .filter((row) => row.startDate && row.name);
}

function rowsFromOrganizationBuckets(
  obj: Record<string, unknown>,
): RawTournamentRow[] {
  const buckets = ["Featured", "Your", "Next"];

  return buckets.flatMap((bucket) => {
    const section = obj[bucket];

    if (!section || typeof section !== "object") return [];

    const tournaments = (section as Record<string, unknown>).Tournaments;

    if (!Array.isArray(tournaments)) return [];

    return rawRowsFromObjectRows(tournaments as Record<string, unknown>[]);
  });
}

function rawRowsFromJson(value: unknown): RawTournamentRow[] {
  if (Array.isArray(value)) {
    if (value.every((row) => Array.isArray(row))) {
      return rawRowsFromArrayRows(value);
    }

    if (value.every((row) => row && typeof row === "object")) {
      return rawRowsFromObjectRows(value as Record<string, unknown>[]);
    }

    return [];
  }

  if (!value || typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;

  const bucketRows = rowsFromOrganizationBuckets(obj);

  if (bucketRows.length > 0) return bucketRows;

  const rows =
    obj.data ?? obj.aaData ?? obj.Data ?? obj.Tournaments ?? obj.tournaments;

  return rawRowsFromJson(rows);
}

function rowsFromHtml(html: string): RawTournamentRow[] {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);

  return rows
    .map((rowHtml): RawTournamentRow | null => {
      const cells = [
        ...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
      ].map((m) => cleanCell(m[1]));

      if (cells.length < 6 || /start date/i.test(cells[0])) return null;

      return {
        id: undefined,
        startDate: cells[0],
        name: cells[1],
        game: cells[2],
        players: cells[5],
        playerCap: "",
        format: undefined,
        imageUrl: undefined,
        url: extractTournamentUrl(rowHtml),
      };
    })
    .filter((row): row is RawTournamentRow => row !== null);
}

function parseResponse(text: string): RawTournamentRow[] {
  const trimmed = text.trim();

  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return rawRowsFromJson(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  return rowsFromHtml(trimmed);
}

function datatablesBody(): URLSearchParams {
  const body = new URLSearchParams();

  body.set("draw", "1");
  body.set("start", "0");
  body.set("length", "2000");
  body.set("search[value]", "");
  body.set("search[regex]", "false");

  const columns = [
    "Start Date",
    "Name",
    "Game",
    "Organizer",
    "Status",
    "Players",
    "Registration",
    "Entry Type",
    "Entry Fee",
  ];

  for (const [index, column] of columns.entries()) {
    body.set(`columns[${index}][data]`, String(index));
    body.set(`columns[${index}][name]`, column);
    body.set(`columns[${index}][searchable]`, "true");
    body.set(`columns[${index}][orderable]`, "true");
    body.set(`columns[${index}][search][value]`, "");
    body.set(`columns[${index}][search][regex]`, "false");
  }

  body.set("order[0][column]", "0");
  body.set("order[0][dir]", "desc");

  return body;
}

async function postEndpoint(
  url: string,
  body: URLSearchParams,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://melee.gg",
      referer: "https://melee.gg/Hub/Organization/2833",
      "user-agent": UA,
      "x-requested-with": "XMLHttpRequest",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${url} returned HTTP ${res.status}.`);
  }

  return res.text();
}

function dedupe(events: NextTournament[]): NextTournament[] {
  const seen = new Set<string>();
  const out: NextTournament[] = [];

  for (const event of events) {
    const key =
      event.url || `${event.date}|${event.time}|${event.name}|${event.game}`;

    if (seen.has(key)) continue;

    seen.add(key);
    out.push(event);
  }

  return out;
}

export async function fetchNextTournaments(
  now = new Date(),
): Promise<NextTournament[]> {
  const body = datatablesBody();

  const responses = await Promise.allSettled([
    postEndpoint(ORGANIZATION_TOURNAMENTS_URL, body),
    postEndpoint(SEARCH_ORGANIZATION_TOURNAMENTS_URL, body),
  ]);

  const rawRows = responses.flatMap((response) =>
    response.status === "fulfilled" ? parseResponse(response.value) : [],
  );

  if (rawRows.length === 0) {
    const errors = responses
      .filter(
        (response): response is PromiseRejectedResult =>
          response.status === "rejected",
      )
      .map((response) =>
        response.reason instanceof Error
          ? response.reason.message
          : String(response.reason),
      );

    if (errors.length > 0) {
      throw new Error(errors.join(" / "));
    }
  }

  return dedupe(
    rawRows
      .map(toTournament)
      .filter((event): event is NextTournament => event !== null)
      .filter((event) => isTodayOrLater(event, now)),
  ).sort(sortTournaments);
}

export const meleeHubUrl = HUB_URL;
