import { ZoneDensity, ZoneType } from '@city/shared';
import type { SimulationEngine } from '../engine';
import { run } from './builders';

type Slot = readonly [number, number];

export interface GridLayout {
  /** Coordinates of the streets (the same values are used for rows and columns). */
  streets: number[];
  /** Free spots for 3×3 coal plants and 2×2 pumps, in placement order. */
  plantSlots: Slot[];
  pumpSlots: Slot[];
}

/**
 * A city that fills any map: a street grid (with water pipes under every street) reaching
 * both edges, dense R/C/I blocks in a 3:1:1 mix, and a west column of utility blocks.
 */
export function buildGridCity(engine: SimulationEngine, spacing = 7): GridLayout {
  const size = engine.world.size;
  const streets: number[] = [];
  for (let s = 3; s <= size - 4; s += spacing) streets.push(s);
  const first = streets[0] as number;
  const last = streets.at(-1) as number;
  for (const y of streets) {
    run(engine, { type: 'road', x0: 0, y0: y, x1: size - 1, y1: y });
    run(engine, { type: 'pipe', x0: 0, y0: y, x1: size - 1, y1: y });
  }
  for (const x of streets) {
    run(engine, { type: 'road', x0: x, y0: first, x1: x, y1: last });
    run(engine, { type: 'pipe', x0: x, y0: first, x1: x, y1: last });
  }

  const plantSlots: Slot[] = [];
  const pumpSlots: Slot[] = [];
  for (let by = 0; by + 1 < streets.length; by++) {
    for (let bx = 0; bx + 1 < streets.length; bx++) {
      const x0 = (streets[bx] as number) + 1;
      const y0 = (streets[by] as number) + 1;
      const x1 = (streets[bx + 1] as number) - 1;
      const y1 = (streets[by + 1] as number) - 1;
      // Utility slots fill from the east side: power only jumps the single street between the
      // first building and the zones next door, the rest conducts through adjacent footprints.
      if (bx === 0) {
        if (by % 3 === 0) {
          for (let dx = x1 - x0 - 2; dx >= 0; dx -= 3) {
            for (let dy = 0; dy + 2 <= y1 - y0; dy += 3) plantSlots.push([x0 + dx, y0 + dy]);
          }
        } else {
          for (let dx = x1 - x0 - 1; dx >= 0; dx -= 2) {
            for (let dy = 0; dy + 1 <= y1 - y0; dy += 2) pumpSlots.push([x0 + dx, y0 + dy]);
          }
        }
        continue;
      }
      const k = (bx + 2 * by) % 5;
      const zone =
        k < 3 ? ZoneType.Residential : k === 3 ? ZoneType.Commercial : ZoneType.Industrial;
      run(engine, { type: 'zone', zone, density: ZoneDensity.Dense, x0, y0, x1, y1 });
    }
  }
  const layout = { streets, plantSlots, pumpSlots };
  placeNext(engine, 'coalPlant', layout.plantSlots);
  placeNext(engine, 'waterPump', layout.pumpSlots);
  placeNext(engine, 'waterPump', layout.pumpSlots);
  return layout;
}

function placeNext(
  engine: SimulationEngine,
  kind: 'coalPlant' | 'waterPump',
  slots: readonly Slot[],
): boolean {
  for (const [x, y] of slots) {
    if (engine.execute({ type: 'place', kind, x, y }).ok) return true;
  }
  return false;
}

/** Automated player for grid cities: adds plants and pumps when demand passes 85% of supply. */
export function maintainGrid(engine: SimulationEngine, layout: GridLayout): number {
  const s = engine.stats();
  let added = 0;
  if (s.power.demand > 0.85 * s.power.supply && placeNext(engine, 'coalPlant', layout.plantSlots))
    added++;
  if (s.water.demand > 0.85 * s.water.supply && placeNext(engine, 'waterPump', layout.pumpSlots))
    added++;
  return added;
}
