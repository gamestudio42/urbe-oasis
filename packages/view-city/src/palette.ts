import { tileHash as themeTileHash } from '@theme/core';

/**
 * Colour helpers of the renderer. Palette values themselves live in a `Theme`; this module keeps
 * the pure arithmetic (shading, blending, per-tile variation) that every theme shares.
 */
export { cssColor, mix, shade } from '@theme/core';

/** Small deterministic per-tile hash for visual variation. */
export function tileHash(x: number, y: number): number {
  return themeTileHash(x, y);
}
