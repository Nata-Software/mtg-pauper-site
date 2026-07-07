/**
 * Cell background for a winrate, red (low) -> yellow (~50%) -> green (high).
 * Low sample sizes are desaturated so they read as "uncertain".
 *
 * Colors are solid (not alpha-blended over the page background) so contrast
 * holds regardless of light/dark theme — `fg` is picked from the resulting
 * lightness rather than assumed to sit on a dark page.
 */
export function winrateColor(
  winrate: number | null,
  matches: number,
): { bg: string; fg: string } {
  if (winrate == null || matches === 0) {
    return { bg: "transparent", fg: "#8b8b8b" };
  }
  const hue = Math.max(0, Math.min(120, winrate * 120)); // 0=red, 120=green
  const conf = Math.min(1, matches / 25); // ramp up with sample size
  const sat = 12 + 50 * conf; // 12% (uncertain, grayish) -> 62% (confident)
  const light = 58 - 16 * conf; // 58% (pale) -> 42% (rich)
  return {
    bg: `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`,
    fg: light > 52 ? "#111827" : "#f9fafb",
  };
}

export function pct(n: number | null): string {
  if (n == null) return "–";
  return `${Math.round(n * 100)}%`;
}
