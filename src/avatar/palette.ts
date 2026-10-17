import type { Palette } from './types.js';

const mod = (v: number, m: number): number => ((v % m) + m) % m;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const hsl = (h: number, s: number, l: number): string =>
  `hsl(${mod(Math.round(h), 360)}, ${Math.round(clamp01(s / 100) * 100)}%, ${Math.round(clamp01(l / 100) * 100)}%)`;

export const hsla = (h: number, s: number, l: number, a: number): string =>
  `hsla(${mod(Math.round(h), 360)}, ${Math.round(clamp01(s / 100) * 100)}%, ${Math.round(clamp01(l / 100) * 100)}%, ${Math.max(0, Math.min(1, a))})`;

/** HSL (0-360, 0-100, 0-100) → linear-ish [r,g,b] in 0..1 for the WebGL renderer. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = clamp01(s / 100);
  const lig = clamp01(l / 100);
  const hue = mod(h, 360) / 360;
  if (sat === 0) return [lig, lig, lig];
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const channel = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

export type HarmonyScheme = 'mono' | 'analogous' | 'complementary' | 'triadic';

/**
 * Resolves the subset of CSS colours the library emits (`hsl()`, `#rgb`,
 * `#rrggbb`) to 0..1 rgb. Unknown input falls back to mid grey rather than
 * throwing, so a bad author-supplied colour degrades instead of breaking.
 */
export function parseColor(css: string): [number, number, number] {
  const value = String(css ?? '')
    .trim()
    .toLowerCase();
  if (!value) return [0.5, 0.5, 0.5];

  const hslMatch = /^hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/.exec(value);
  if (hslMatch) {
    return hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
  }

  let hex = value.replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    const n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return [0.5, 0.5, 0.5];
}

export interface PaletteInput {
  hue: number;
  saturation?: number;
  lightness?: number;
  scheme?: HarmonyScheme;
}

const ACCENT_SHIFT: Record<HarmonyScheme, number> = {
  mono: 0,
  analogous: 32,
  complementary: 180,
  triadic: 120,
};

/** Builds the full colour ramp from three numbers. */
export function createPalette(input: PaletteInput): Palette {
  const hue = mod(input.hue, 360);
  const saturation = Math.max(0, Math.min(100, input.saturation ?? 62));
  const lightness = Math.max(12, Math.min(84, input.lightness ?? 60));
  const scheme: HarmonyScheme = input.scheme ?? 'analogous';
  const accentHue = hue + ACCENT_SHIFT[scheme];

  return {
    hue,
    saturation,
    lightness,
    base: hsl(hue, saturation, lightness),
    light: hsl(hue, saturation * 0.92, Math.min(92, lightness + 16)),
    dark: hsl(hue, Math.min(100, saturation * 1.08), Math.max(14, lightness - 20)),
    accent: hsl(accentHue, Math.min(100, saturation + 12), Math.min(80, lightness + 4)),
    outline: hsl(hue, Math.min(100, saturation * 0.9), Math.max(8, lightness - 42)),
    eye: hsl(hue, Math.min(35, saturation * 0.4), 14),
    cheek: hsla(hue + 22, 78, 70, 0.55),
    background: 'transparent',
  };
}

export const NEUTRAL_ACCESSORY_COLORS = ['#2f3437', '#f4f5f7', '#d9dee3', '#f7c948'] as const;

/** Numeric version of the palette for the WebGL renderer (avoids CSS colour parsing). */
export interface NumericPalette {
  base: [number, number, number];
  light: [number, number, number];
  dark: [number, number, number];
  accent: [number, number, number];
  eye: [number, number, number];
  outline: [number, number, number];
  cheek: [number, number, number];
}
export function toNumericPalette(palette: Palette): NumericPalette {
  const { hue, saturation, lightness } = palette;
  return {
    base: hslToRgb(hue, saturation, lightness),
    light: hslToRgb(hue, saturation * 0.92, Math.min(92, lightness + 16)),
    dark: hslToRgb(hue, Math.min(100, saturation * 1.08), Math.max(14, lightness - 20)),
    accent: hslToRgb(
      hue + ACCENT_SHIFT.analogous,
      Math.min(100, saturation + 12),
      Math.min(80, lightness + 4),
    ),
    eye: hslToRgb(hue, Math.min(35, saturation * 0.4), 14),
    outline: hslToRgb(hue, Math.min(100, saturation * 0.9), Math.max(8, lightness - 42)),
    cheek: parseColor(palette.cheek),
  };
}
