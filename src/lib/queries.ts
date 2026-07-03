import { prisma } from "./prisma";
import { toISODate } from "./dates";
import type { MatchRow } from "./stats";

export type Filters = {
  store: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  event?: string;
};

function dateWhere(from?: string, to?: string) {
  const date: { gte?: Date; lte?: Date } = {};
  if (from) date.gte = new Date(from + "T00:00:00.000Z");
  if (to) date.lte = new Date(to + "T23:59:59.999Z");
  return Object.keys(date).length ? date : undefined;
}

/** Distinct stores that have any data. */
export async function listStores(): Promise<string[]> {
  const [m, s] = await Promise.all([
    prisma.match.findMany({ distinct: ["store"], select: { store: true } }),
    prisma.standing.findMany({ distinct: ["store"], select: { store: true } }),
  ]);
  const set = new Set([...m, ...s].map((r) => r.store));
  return [...set].sort();
}

/** Distinct event names for a store. */
export async function listEvents(store: string): Promise<string[]> {
  const rows = await prisma.match.findMany({
    where: { store },
    distinct: ["eventName"],
    select: { eventName: true },
  });
  return rows.map((r) => r.eventName).filter(Boolean).sort();
}

/** Min/max match dates for a store (for default filter bounds). */
export async function dateBounds(
  store: string,
): Promise<{ min: string; max: string }> {
  const [min, max] = await Promise.all([
    prisma.match.findFirst({
      where: { store, date: { not: null } },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.match.findFirst({
      where: { store, date: { not: null } },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);
  return { min: toISODate(min?.date), max: toISODate(max?.date) };
}

export async function getMatchRows(f: Filters): Promise<MatchRow[]> {
  const rows = await prisma.match.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(dateWhere(f.from, f.to) ? { date: dateWhere(f.from, f.to) } : {}),
    },
    select: { deck: true, opponentDeck: true, result: true },
  });
  return rows;
}

export type StandingRow = {
  position: number;
  nickname: string;
  fullName: string;
  deck: string;
  points: number;
  eventName: string;
  date: Date | null;
};

export async function getStandings(f: Filters): Promise<StandingRow[]> {
  return prisma.standing.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(dateWhere(f.from, f.to) ? { date: dateWhere(f.from, f.to) } : {}),
    },
    orderBy: [{ date: "desc" }, { position: "asc" }],
    select: {
      position: true,
      nickname: true,
      fullName: true,
      deck: true,
      points: true,
      eventName: true,
      date: true,
    },
    take: 2000,
  });
}
