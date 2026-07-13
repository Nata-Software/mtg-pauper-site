export function clean(name: string | null | undefined): string;
export const SYNONYMS: Record<string, string>;
export function colorKey(cleaned: string): string;
export function isBare(cleaned: string): boolean;
export function display(cleaned: string): string;
export function canonicalDeck(
  archetype: string | null | undefined,
  deck: string,
  resolve?: (colorKey: string) => string | undefined,
): string;
