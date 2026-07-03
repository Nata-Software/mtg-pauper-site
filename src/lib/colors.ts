/**
 * Cell background for a winrate, red (low) -> yellow (~50%) -> green (high).
 * Low sample sizes are desaturated so they read as "uncertain".
 */
export function winrateColor(
  winrate: number | null,
  matches: number,
): { bg: string; fg: string } {
  if (winrate == null || matches === 0) {
    return { bg: "transparent", fg: "#6b7280" };
  }
  const hue = Math.max(0, Math.min(120, winrate * 120)); // 0=red, 120=green
  const conf = Math.min(1, matches / 25); // ramp up with sample size
  const alpha = 0.18 + 0.55 * conf;
  return {
    bg: `hsla(${hue.toFixed(0)}, 62%, 42%, ${alpha.toFixed(2)})`,
    fg: "#f9fafb",
  };
}

export function pct(n: number | null): string {
  if (n == null) return "–";
  return `${Math.round(n * 100)}%`;
}
