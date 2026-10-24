import { isZoneKind, type BuildingRecord } from '@city/shared';
import { color, type Theme } from '@theme/core';
import type { Graphics } from 'pixi.js';
import { tileLocalToScreen, type Point } from './iso';

/** Cosmetic frontage only: reads service flags, never grants water or shade. */
export function drawOasisLotDetails(
  g: Graphics,
  theme: Theme,
  q: [Point, Point, Point, Point],
  b: BuildingRecord,
): void {
  if (theme.style !== 'adobe' || !isZoneKind(b.kind) || b.kind === 'industrial' || b.abandoned)
    return;
  const at = (u: number, v: number) => tileLocalToScreen(q, u, v);
  const strip = (u0: number, v0: number, u1: number, v1: number, fill: number) => {
    const points = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    g.poly(points.flatMap((p) => [p.x, p.y])).fill(fill);
  };
  // A narrow irrigation trough along the east frontage. Dry lots retain its empty basin.
  strip(0.93, 0.15, 0.99, 0.87, color(theme, 'infra.canalDark'));
  if (b.watered) strip(0.95, 0.18, 0.98, 0.84, color(theme, 'overlay.waterOn'));
  // Low planters on the south edge leave the adobe silhouette and doors unobscured.
  const lush = b.watered && b.linked === true;
  for (let k = 0; k < 3; k++) {
    const u = 0.15 + k * 0.23;
    strip(u, 0.93, u + 0.12, 0.99, color(theme, 'ground.bareLot'));
    const p = at(u + 0.06, 0.96);
    if (lush) {
      g.ellipse(p.x, p.y - 1, 2.4, 1.5).fill(color(theme, 'tree.leafDark'));
      g.ellipse(p.x, p.y - 2, 1.6, 1.2).fill(color(theme, 'tree.leafLight'));
    } else {
      g.moveTo(p.x - 1.5, p.y)
        .lineTo(p.x, p.y - 1)
        .lineTo(p.x + 1.5, p.y)
        .stroke({ color: color(theme, 'infra.canalDark'), width: 0.7, alpha: 0.7 });
    }
  }
}
