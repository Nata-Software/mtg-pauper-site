export type Card = { qty: number; slug: string; name: string };

export function classifyDeck(
  cards: Card[],
  typedName: string,
  model: unknown,
): string;
export const LAND_COLOR: Record<string, string>;
export function isBasic(slug: string): boolean;
export function colorSet(cards: Card[]): Set<string>;
export function colorSources(cards: Card[]): Record<string, number>;
export function colorPrefix(set: Set<string>): string;
export function vec(
  cards: Card[],
  idf: (s: string) => number,
): Record<string, number>;
export function cosine(
  a: Record<string, number>,
  b: Record<string, number>,
): number;
