import Link from "next/link";

import { listDecks } from "@/lib/cards/queries";
import { getLocale } from "@/lib/i18n.server";
import { monthsAgoISO, toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Date windows, defaulting to the last 2 months. */
const RANGES = [
  { key: "2m", months: 2, en: "Last 2 months", pt: "Últimos 2 meses" },
  { key: "6m", months: 6, en: "Last 6 months", pt: "Últimos 6 meses" },
  { key: "12m", months: 12, en: "Last 12 months", pt: "Últimos 12 meses" },
  { key: "all", months: 600, en: "All time", pt: "Desde o início" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function parseRange(v: string | undefined): RangeKey {
  return (RANGES.find((r) => r.key === v)?.key ?? "2m") as RangeKey;
}

/**
 * The landing page: a metagame grid with a real decklist behind every tile.
 * Individual decks live at /decks/<name>; the matchup matrix moved to
 * /matchups.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const pt = locale === "pt-BR";
  const sp = await searchParams;

  const range = parseRange(first(sp.range));
  const preset = RANGES.find((r) => r.key === range)!;
  const to = toISODate(new Date());
  const from = monthsAgoISO(preset.months);

  const decks = (await listDecks("default", from, to)).filter(
    (d) => d.matches > 0,
  );
  const totalMatches = decks.reduce((n, d) => n + d.matches, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        {pt ? "Metagame Pauper" : "Pauper Metagame"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {decks.length} decks · {totalMatches.toLocaleString()}{" "}
        {pt ? "partidas" : "matches"} · {from} → {to}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/?range=${r.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              r.key === range
                ? "border-violet-500 bg-violet-600 text-white"
                : "border-neutral-300 text-neutral-600 hover:border-violet-400 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            {pt ? r.pt : r.en}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {decks.map((d) => {
          const share = totalMatches ? (100 * d.matches) / totalMatches : 0;
          const winPct = d.matches ? (100 * d.wins) / d.matches : 0;

          return (
            <Link
              key={d.deck}
              href={`/decks/${encodeURIComponent(d.deck)}?range=${range}`}
              className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
            >
              {/* Scryfall's art_crop is roughly 4:3, so match it — a short
                  letterbox strip cropped most of the art away. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                {d.artUrl ? (
                  <div
                    className="h-full w-full bg-cover bg-center transition group-hover:scale-105"
                    style={{ backgroundImage: `url("${d.artUrl}")` }}
                    role="img"
                    aria-label={d.signatureCard ?? ""}
                  />
                ) : null}
              </div>

              <div className="p-4">
                <h2 className="font-semibold text-violet-700 group-hover:underline dark:text-violet-400">
                  {d.deck}
                </h2>
                {d.signatureCard && (
                  <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                    {d.signatureCard}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Cell label="META%" value={`${share.toFixed(1)}%`} />
                  <Cell
                    label={pt ? "Vitórias" : "Win%"}
                    value={`${winPct.toFixed(1)}%`}
                  />
                  <Cell
                    label={pt ? "Partidas" : "Matches"}
                    value={d.matches.toLocaleString()}
                  />
                </dl>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="font-bold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
