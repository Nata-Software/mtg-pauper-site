/**
 * Cell colors for a winrate, red (low) -> yellow (~50%) -> green (high).
 * Low sample sizes are desaturated so they read as "uncertain".
 *
 * Returns separate light/dark variants (picked via CSS custom properties,
 * not media queries, since theme here is a `data-theme` attribute toggle).
 * Dark mode uses solid, richly-saturated fills — they read fine against a
 * near-black page. Light mode instead uses pale, low-saturation tints with
 * a darker hue-matched foreground; a solid fill at dark-mode lightness
 * looks like an opaque block on white, whereas a soft tint + colored text
 * is the convention most light-theme data tables (GitHub, Linear, Notion)
 * use for this kind of heatmap.
 */
export function winrateColor(
  winrate: number | null,
  matches: number,
): { bgLight: string; fgLight: string; bgDark: string; fgDark: string } {
  if (winrate == null || matches === 0) {
    return {
      bgLight: "transparent",
      fgLight: "#78716c",
      bgDark: "transparent",
      fgDark: "#a8a29e",
    };
  }
  const hue = Math.max(0, Math.min(120, winrate * 120)); // 0=red, 120=green
  const conf = Math.min(1, matches / 25); // ramp up with sample size

  const satDark = 12 + 50 * conf; // 12% (uncertain, grayish) -> 62% (confident)
  const lightDark = 58 - 16 * conf; // 58% (pale) -> 42% (rich)

  const satLight = 30 + 35 * conf; // 30% (muted) -> 65% (confident), still pastel
  const lightLightBg = 93 - 10 * conf; // 93% (near-white) -> 83% (soft wash)
  const satFgLight = 20 + 45 * conf; // 20% (near-neutral) -> 65% (colorful)
  const lightFgLight = 30 - 6 * conf; // 30% -> 24%, always dark enough for contrast

  return {
    bgLight: `hsl(${hue.toFixed(0)}, ${satLight.toFixed(0)}%, ${lightLightBg.toFixed(0)}%)`,
    fgLight: `hsl(${hue.toFixed(0)}, ${satFgLight.toFixed(0)}%, ${lightFgLight.toFixed(0)}%)`,
    bgDark: `hsl(${hue.toFixed(0)}, ${satDark.toFixed(0)}%, ${lightDark.toFixed(0)}%)`,
    fgDark: lightDark > 52 ? "#111827" : "#f9fafb",
  };
}

export function pct(n: number | null): string {
  if (n == null) return "–";
  return `${Math.round(n * 100)}%`;
}
