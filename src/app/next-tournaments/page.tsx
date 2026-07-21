import Link from "next/link";

import {
  fetchNextTournaments,
  meleeHubUrl,
  type NextTournament,
} from "@/lib/melee-next-tournaments";
import { getLocale } from "@/lib/i18n.server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
type View = "next-2-weeks" | "all";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseView(value: string | undefined): View {
  return value === "all" ? "all" : "next-2-weeks";
}

function copy(locale: Locale) {
  const isPt = locale === "pt-BR";

  return {
    title: isPt ? "Próximos Torneios" : "Next Tournaments",
    subtitleNextTwoWeeks: isPt
      ? "Torneios acontecendo hoje ou nos próximos 7 dias, ordenados por data, horário e nome."
      : "Tournaments happening today or in the next 7 days, sorted by date, time, then name.",
    subtitleAll: isPt
      ? "Todos os torneios futuros, ordenados por data, horário e nome."
      : "All future tournaments, sorted by date, time, then name.",
    nextTwoWeeks: isPt ? "Próxima Semana" : "Next Week",
    allTournaments: isPt ? "Todos os Torneios" : "All Tournaments",
    emptyNextTwoWeeks: isPt
      ? "Nenhum torneio encontrado para a próxima semana."
      : "No tournaments found for the next week.",
    emptyAll: isPt
      ? "Nenhum torneio futuro encontrado."
      : "No future tournaments found.",
    loadError: isPt
      ? "Não foi possível carregar os torneios do Melee:"
      : "Could not load upcoming tournaments from Melee:",
    players: isPt ? "inscritos" : "registered",
    viewOnMelee: isPt ? "Ver no Melee →" : "View on Melee →",
  };
}

function saoPauloTodayStart(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return Date.parse(
    `${get("year")}-${get("month")}-${get("day")}T00:00:00-03:00`,
  );
}

function tournamentTimestamp(event: NextTournament): number {
  return Date.parse(`${event.date}T${event.time}:00-03:00`);
}

function isInNextTwoWeeks(event: NextTournament, now: Date): boolean {
  const start = saoPauloTodayStart(now);

  // Today + the next 7 calendar days, inclusive.
  const endExclusive = start + 8 * 24 * 60 * 60 * 1000;
  const timestamp = tournamentTimestamp(event);

  return timestamp >= start && timestamp < endExclusive;
}

function filterForView(
  tournaments: NextTournament[],
  view: View,
  now = new Date(),
): NextTournament[] {
  if (view === "all") {
    return tournaments;
  }

  return tournaments.filter((event) => isInNextTwoWeeks(event, now));
}

function formatDateLine(event: NextTournament, locale: Locale): string {
  const date = new Date(`${event.date}T${event.time}:00-03:00`);
  const isPt = locale === "pt-BR";

  if (Number.isNaN(date.getTime())) {
    return `${event.date} · ${event.time}`;
  }

  const weekday = new Intl.DateTimeFormat(isPt ? "pt-BR" : "en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();

  const day = new Intl.DateTimeFormat(isPt ? "pt-BR" : "en-US", {
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);

  const month = new Intl.DateTimeFormat(isPt ? "pt-BR" : "en-US", {
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();

  if (isPt) {
    return `${weekday}., ${day} DE ${month} · ${event.time}`;
  }

  return `${weekday}, ${month} ${day} · ${event.time}`;
}

function badgeLabel(event: NextTournament): string {
  if (event.format) {
    return event.format.toUpperCase();
  }

  if (/star wars/i.test(event.game)) {
    return "STAR WARS";
  }

  return event.game || "EVENT";
}

function imageFallbackLabel(event: NextTournament): string {
  const label = event.format || event.game || event.name;

  return label.toUpperCase();
}

function TournamentTabs({ view, locale }: { view: View; locale: Locale }) {
  const labels = copy(locale);

  const tabs: { key: View; label: string; href: string }[] = [
    {
      key: "next-2-weeks",
      label: labels.nextTwoWeeks,
      href: "/next-tournaments",
    },
    {
      key: "all",
      label: labels.allTournaments,
      href: "/next-tournaments?view=all",
    },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.key === view;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={
              active
                ? "rounded-md bg-red-700 px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function TournamentCard({
  event,
  locale,
}: {
  event: NextTournament;
  locale: Locale;
}) {
  const labels = copy(locale);
  const label = badgeLabel(event);

  return (
    <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
      <div
        className="relative h-32 bg-neutral-900 bg-cover bg-center"
        style={
          event.imageUrl
            ? { backgroundImage: `url("${event.imageUrl}")` }
            : undefined
        }
      >
        {!event.imageUrl && (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 px-4 text-center text-xl font-black uppercase tracking-wide text-white/80">
            {imageFallbackLabel(event)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-black/10" />

        <span className="absolute left-3 top-3 rounded-full bg-red-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          {label}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          {formatDateLine(event, locale)}
        </p>

        <h2 className="line-clamp-2 text-base font-bold leading-snug text-neutral-950 dark:text-white">
          {event.name}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            <span className="font-bold text-neutral-950 dark:text-white">
              {event.players.toLocaleString()}
            </span>
            {event.playerCap ? ` / ${event.playerCap}` : ""} {labels.players}
          </p>

          {event.url && (
            <Link
              href={event.url}
              className="text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
              target="_blank"
              rel="noreferrer"
            >
              {labels.viewOnMelee}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function TournamentGrid({
  tournaments,
  locale,
  emptyMessage,
}: {
  tournaments: NextTournament[];
  locale: Locale;
  emptyMessage: string;
}) {
  if (tournaments.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tournaments.map((event) => (
        <TournamentCard
          key={`${event.date}-${event.time}-${event.name}`}
          event={event}
          locale={locale}
        />
      ))}
    </div>
  );
}

export default async function NextTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const labels = copy(locale);
  const sp = await searchParams;
  const view = parseView(first(sp.view));

  let tournaments: NextTournament[] = [];
  let loadError: string | null = null;

  try {
    tournaments = await fetchNextTournaments();
  } catch (err) {
    loadError = (err as Error).message;
  }

  const shownTournaments = filterForView(tournaments, view);
  const subtitle =
    view === "all" ? labels.subtitleAll : labels.subtitleNextTwoWeeks;
  const emptyMessage =
    view === "all" ? labels.emptyAll : labels.emptyNextTwoWeeks;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          {labels.title}
        </h1>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {subtitle}{" "}
          <Link
            href={meleeHubUrl}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Melee
          </Link>
          .
        </p>
      </div>

      <TournamentTabs view={view} locale={locale} />

      {loadError ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {labels.loadError} {loadError}
        </p>
      ) : (
        <TournamentGrid
          tournaments={shownTournaments}
          locale={locale}
          emptyMessage={emptyMessage}
        />
      )}
    </div>
  );
}
