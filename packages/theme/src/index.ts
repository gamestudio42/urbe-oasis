import { cssColor, mix } from './color';
import type { LotPalette } from './tokens';

export { cssColor, mix, shade, tileHash } from './color';
export { COLOR_TOKENS, type BoxColors, type ColorToken, type LotPalette } from './tokens';

/**
 * Everything the isometric renderer needs to know about art direction. The renderer only reads
 * this object, so a new look is a new theme rather than a copy of the drawing code.
 */
/**
 * Architecture style: the shape language a theme asks the renderer for.
 *
 * `classic` draws the traditional civic and utility silhouettes; `cyber` draws the armoured,
 * neon-lit variants that read as a high-tech installation. Colours and shapes stay separate
 * concerns, so a theme can recolour the classic shapes or swap in its own architecture.
 */
export type ThemeStyle = 'classic' | 'cyber' | 'adobe';

export interface Theme {
  /** Stable identifier, used for CSS and diagnostics. */
  readonly id: string;
  /** Architecture style for the civic and utility buildings. */
  readonly style: ThemeStyle;
  /** Semantic colours; every token in `COLOR_TOKENS` must be present. */
  readonly colors: Readonly<Record<string, number>>;
  /** Ground colour per `Terrain` value. */
  readonly terrain: readonly number[];
  /** Zone marker colour per `ZoneType` value, index 0 unused. */
  readonly zone: readonly number[];
  /** Lot plate colour per `ZoneType` value, index 0 unused. */
  readonly lot: readonly number[];
  /** Level 1-2 housing styles, indexed by `variant & 3`. */
  readonly housePalettes: readonly LotPalette[];
  /** Level 3-5 housing styles. */
  readonly towerPalettes: readonly LotPalette[];
  /** Commercial styles of every level. */
  readonly commercialPalettes: readonly LotPalette[];
  /** Industrial styles. */
  readonly industrialPalettes: readonly LotPalette[];
  /** Abandoned lots use this instead of their palette. */
  readonly abandoned: LotPalette;
  /** Hull colours of cosmetic boats. */
  readonly boats: readonly number[];
  /** Body colours of cosmetic cars. */
  readonly cars: readonly number[];
  /** Pixi clear colour behind the map. */
  readonly background: number;
}

/** Read a token, failing loudly instead of drawing black when a theme misses one. */
export function color(theme: Theme, token: string): number {
  const value = theme.colors[token];
  if (value === undefined) throw new Error(`Theme "${theme.id}" is missing colour "${token}"`);
  return value;
}

/**
 * Gradient for "bad" values (traffic, pollution): low is good, high is alarming.
 * Used by overlays and their legend.
 */
export function heatColor(theme: Theme, t: number): number {
  const v = Math.max(0, Math.min(1, t));
  const low = color(theme, 'overlay.heatLow');
  const mid = color(theme, 'overlay.heatMid');
  const high = color(theme, 'overlay.heatHigh');
  return v < 0.5 ? mix(low, mid, v * 2) : mix(mid, high, (v - 0.5) * 2);
}

/** Gradient for "good" values (coverage, land value): low is bad, high is healthy. */
export function goodColor(theme: Theme, t: number): number {
  const v = Math.max(0, Math.min(1, t));
  const low = color(theme, 'overlay.goodLow');
  const mid = color(theme, 'overlay.goodMid');
  const high = color(theme, 'overlay.goodHigh');
  return v < 0.5 ? mix(low, mid, v * 2) : mix(mid, high, (v - 0.5) * 2);
}

/** CSS `#rrggbb` helper re-exported for UI consumers that paint legends. */
export { cssColor as css };
