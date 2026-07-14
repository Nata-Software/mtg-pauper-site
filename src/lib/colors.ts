function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: [number, number, number] = [1, 1, 1];

/**
 * HSL lightness doesn't track perceived luminance across hues: yellow/green
 * are far brighter than red/blue at the same `l`, so a fixed lightness ramp
 * leaves yellow-green cells looking washed out against a white page while
 * red cells look fine. Binary-search the lightness per-hue instead, so every
 * hue hits the same actual contrast ratio against white.
 */
function lightnessForContrastVsWhite(
  hue: number,
  sat: number,
  target: number,
): number {
  let lo = 15;
  let hi = 96;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const c = contrastRatio(hslToRgb(hue, sat, mid), WHITE);
    if (c < target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Same idea for the foreground text: solve for the darkest-enough lightness
 * that hits a fixed contrast ratio against the (hue-dependent) background. */
function fgLightnessForContrast(
  hue: number,
  sat: number,
  bg: [number, number, number],
  target: number,
): number {
  let lo = 2;
  let hi = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const c = contrastRatio(hslToRgb(hue, sat, mid), bg);
    if (c < target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Cell colors for a winrate, red (low) -> yellow (~50%) -> green (high).
 * Low sample sizes are desaturated so they read as "uncertain".
 *
 * Returns separate light/dark variants (picked via CSS custom properties,
 * not media queries, since theme here is a `data-theme` attribute toggle).
 * Dark mode uses solid, richly-saturated fills — they read fine against a
 * near-black page. Light mode uses a hue-matched tint whose lightness is
 * solved per-hue (see `lightnessForContrastVsWhite`) so it hits a target
 * contrast ratio against the white page, and hue-matched text solved to
 * always clear WCAG AA against that tint.
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

  const satDark = 45 + 53 * conf; // 45% (muted) -> 98% (confident)
  const lightDark = 58 - 26 * conf; // 58% (pale) -> 32% (rich)

  const satLight = 75 + 25 * conf; // 75% (muted) -> 100% (confident)
  const bgContrastTarget = 2.2 + 1.2 * conf; // clear tint -> bold wash
  const lightLightBg = lightnessForContrastVsWhite(
    hue,
    satLight,
    bgContrastTarget,
  );
  const bgLightRgb = hslToRgb(hue, satLight, lightLightBg);

  const satFgLight = 55 + 45 * conf; // 55% (muted) -> 100% (colorful)
  const lightFgLight = fgLightnessForContrast(hue, satFgLight, bgLightRgb, 5.5);

  return {
    bgLight: `hsl(${hue.toFixed(0)}, ${satLight.toFixed(0)}%, ${lightLightBg.toFixed(0)}%)`,
    fgLight: `hsl(${hue.toFixed(0)}, ${satFgLight.toFixed(0)}%, ${lightFgLight.toFixed(0)}%)`,
    bgDark: `hsl(${hue.toFixed(0)}, ${satDark.toFixed(0)}%, ${lightDark.toFixed(0)}%)`,
    fgDark: lightDark > 49 ? "#111827" : "#f9fafb",
  };
}

export function pct(n: number | null): string {
  if (n == null) return "–";
  return `${Math.round(n * 100)}%`;
}
