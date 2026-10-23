import {
  BALANCE,
  Infra,
  PLACEABLE_SPECS,
  Terrain,
  ZoneDensity,
  ZoneType,
  type ToolCommand,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { tileVariant } from '../world/variant';
import { DemolishOp, type ToolPlan } from './plan';

/** Applies a plan produced by `planToolCommand` for the same command and state. */
export function applyToolPlan(
  engine: SimulationEngine,
  command: ToolCommand,
  plan: ToolPlan,
): void {
  const w = engine.world;
  switch (command.type) {
    case 'road':
      for (const i of plan.valid) {
        w.setInfra(i, Infra.Road, true);
        clearSurface(engine, i);
      }
      break;
    case 'powerLine':
      for (const i of plan.valid) {
        w.setInfra(i, Infra.PowerLine, true);
        w.setLayer('trees', i, 0);
      }
      break;
    case 'pipe':
      for (const i of plan.valid) w.setInfra(i, Infra.Pipe, true);
      break;
    case 'canal':
      for (const i of plan.valid) w.setInfra(i, Infra.Canal, true);
      break;
    case 'zone':
      for (const i of plan.valid) {
        w.setLayer('zone', i, command.zone);
        w.setLayer(
          'zoneDensity',
          i,
          command.zone === ZoneType.None ? ZoneDensity.None : command.density,
        );
        if (command.zone !== ZoneType.None) w.setLayer('trees', i, 0);
      }
      break;
    case 'plantTrees':
      for (const i of plan.valid) w.setLayer('trees', i, 3);
      break;
    case 'demolish':
      for (const id of plan.removeBuildings) engine.buildings.remove(id);
      plan.valid.forEach((i, k) => {
        switch (plan.ops[k]) {
          case DemolishOp.Surface:
            w.setInfra(i, Infra.Road | Infra.PowerLine | Infra.Rubble, false);
            break;
          case DemolishOp.Zone:
            w.setLayer('zone', i, ZoneType.None);
            w.setLayer('zoneDensity', i, ZoneDensity.None);
            break;
          case DemolishOp.Trees:
            w.setLayer('trees', i, 0);
            break;
          case DemolishOp.Pipe:
            w.setInfra(i, Infra.Pipe, false);
            break;
          case DemolishOp.Canal:
            w.setInfra(i, Infra.Canal, false);
            break;
          default:
            break;
        }
      });
      break;
    case 'place': {
      const spec = PLACEABLE_SPECS[command.kind];
      for (const i of plan.valid) clearSurface(engine, i);
      engine.buildings.add({
        kind: command.kind,
        x: command.x,
        y: command.y,
        w: spec.size,
        h: spec.size,
        level: 1,
        capacity: spec.powerSupply || spec.waterSupply || spec.jobs,
        occupancy: 0,
        condition: 100,
        age: 0,
        abandoned: false,
        emptyMonths: 0,
        variant: tileVariant(command.x, command.y),
        powered: false,
        watered: false,
        ...(engine.ruleset === 'oasis' ? { linked: false } : {}),
        offline: 0,
        attractiveness: 0,
      });
      break;
    }
    case 'level':
    case 'raise':
    case 'lower':
      applyHeights(engine, plan.heights);
      break;
  }
  engine.economy.funds -= plan.cost;
  engine.economy.constructionThisMonth += plan.cost;
  engine.networksDirty = true;
}

/** Clears trees and any zone designation on a tile that receives construction. */
function clearSurface(engine: SimulationEngine, i: number): void {
  const w = engine.world;
  w.setLayer('trees', i, 0);
  w.setLayer('zone', i, ZoneType.None);
  w.setLayer('zoneDensity', i, ZoneDensity.None);
}

function applyHeights(engine: SimulationEngine, heights: Array<[number, number]>): void {
  const w = engine.world;
  const vs = w.vertexSize;
  for (const [v, h] of heights) w.heights[v] = Math.min(h, BALANCE.map.maxHeight);
  w.heightsDirty = true;
  for (const [v] of heights) {
    const vx = v % vs;
    const vy = (v / vs) | 0;
    for (let ty = vy - 1; ty <= vy; ty++) {
      for (let tx = vx - 1; tx <= vx; tx++) {
        if (!w.inBounds(tx, ty)) continue;
        const i = w.index(tx, ty);
        w.markDirty(i);
        // Raising the bed of a water tile turns it into land fill.
        if (w.isWater(i) && w.maxCorner(tx, ty) > 0) w.setLayer('terrain', i, Terrain.Sand);
      }
    }
  }
}
