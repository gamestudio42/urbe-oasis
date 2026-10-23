import { OASIS_WATER, type BuildingRecord } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import {
  oasisWaterOutput,
  waterDemand,
  waterNetworkComponents,
  type UtilityResult,
} from '../utilities';

/**
 * Unstable power grid (neon ruleset).
 *
 * The classic solver already balances supply and demand per connected component. This layer adds
 * the cyberpunk failure modes on top of that solution:
 *
 * - **Overload**: a component whose demand reaches `overloadThreshold` of its supply is stressed.
 *   Stressed components are stored in `oasis.parched` so the UI and the inspector can show it.
 * - **Cascade**: a stressed component can blow a qanat, taking a share of its buildings
 *   offline for a few days. The outage uses the existing `offline` counter, so every consumer
 *   (services, pumps, hubs) already respects it.
 * - **Batteries**: a bank charges while its component has headroom and releases energy while the
 *   component is short. Charge is persisted per building.
 *
 * Every random decision draws from `engine.rng` in building order, so a seed plus a command log
 * always replays the same outages.
 */

/** Result of one grid pass, for diagnostics and reports. */
export interface GridResult {
  /** Components at or above the overload threshold. */
  parched: number;
  /** Buildings thrown offline by cascades this pass. */
  cascaded: number;
  /** Power delivered by cisterns this pass. */
  cisternOutput: number;
}

/** One connected component of the power network. */
interface Component {
  buildings: BuildingRecord[];
  cisterns: BuildingRecord[];
  supply: number;
  demand: number;
}

/**
 * Recomputes grid stress from the current network. Called after `refreshUtilities()`, so
 * `oasis.parched` always describes the live solution.
 */
export function updateGrid(engine: SimulationEngine): GridResult {
  const result: GridResult = { parched: 0, cascaded: 0, cisternOutput: 0 };
  const components = waterComponents(engine);
  const parched: number[] = [];

  for (const component of components) {
    if (component.supply <= 0) continue;
    if (component.demand / component.supply < OASIS_WATER.overloadThreshold) continue;
    result.parched++;
    const anchor = component.buildings[0];
    if (anchor) parched.push(engine.world.index(anchor.x, anchor.y));
  }
  engine.oasis.parched = parched;
  result.cisternOutput = dischargeBatteries(engine, components);
  return result;
}

/** Groups buildings into water components with the same traversal as the classic solver. */
function waterComponents(engine: SimulationEngine): Component[] {
  const components: Component[] = [];
  for (const buildings of waterNetworkComponents(engine)) {
    const component: Component = { buildings, cisterns: [], supply: 0, demand: 0 };
    for (const b of buildings) {
      component.supply += oasisWaterOutput(engine, b);
      component.demand += waterDemand(b);
      if (b.kind === 'cistern') component.cisterns.push(b);
    }
    components.push(component);
  }
  return components;
}

/**
 * Battery banks: charge while the component has headroom, discharge while it is short. A bank
 * covers `cisternOutput` of missing power per tick, draining one `cisternDischarge` step.
 */
function dischargeBatteries(engine: SimulationEngine, components: Component[]): number {
  const banks = engine.oasis.cisterns;
  let delivered = 0;
  for (const component of components) {
    if (component.cisterns.length === 0) continue;
    const shortfall = component.demand - component.supply;
    const share = Math.min(
      OASIS_WATER.cisternOutput,
      shortfall > 0 ? shortfall / component.cisterns.length : 0,
    );
    for (const bank of component.cisterns) {
      const entry = chargeOf(banks, bank.id);
      if (shortfall > 0) {
        delivered += share;
        entry.charge = Math.max(0, entry.charge - OASIS_WATER.cisternDischarge);
      } else {
        entry.charge = Math.min(1, entry.charge + OASIS_WATER.cisternDischarge);
      }
    }
  }
  return delivered;
}

function chargeOf(
  list: Array<{ buildingId: number; charge: number }>,
  id: number,
): { buildingId: number; charge: number } {
  const found = list.find((b) => b.buildingId === id);
  if (found) return found;
  const created = { buildingId: id, charge: 0 };
  list.push(created);
  return created;
}

/**
 * Daily: a stressed component may blow a qanat. When it does, a share of its buildings goes
 * offline for `cascadeOutageDays`, and the event is emitted once for the toast and the sound.
 */
export function cascade(engine: SimulationEngine, utilities: UtilityResult): GridResult {
  const result: GridResult = { parched: engine.oasis.parched.length, cascaded: 0, cisternOutput: 0 };
  if (!utilities.shortage) return result;
  const ticks = OASIS_WATER.cascadeOutageDays * 4;
  for (const component of waterComponents(engine)) {
    const ratio = component.supply > 0 ? component.demand / component.supply : 0;
    if (ratio < OASIS_WATER.overloadThreshold) continue;
    if (!engine.rng.chance(OASIS_WATER.cascadeChance)) continue;
    const targets: BuildingRecord[] = component.buildings.filter(
      (b) => b.offline === 0 && b.kind !== 'cistern' && b.kind !== 'qanat',
    );
    if (targets.length === 0) continue;
    const share = Math.max(1, Math.round(targets.length * OASIS_WATER.cascadeShare));
    for (let k = 0; k < share; k++) {
      const b = targets[engine.rng.range(0, targets.length - 1)];
      if (!b || b.offline > 0) continue;
      b.offline = ticks;
      engine.buildings.touch(b);
      result.cascaded++;
    }
    const anchor = targets[0] as BuildingRecord;
    engine.emit({ type: 'waterStress', x: anchor.x, y: anchor.y });
    engine.emit({ type: 'canalCollapse', x: anchor.x, y: anchor.y, tiles: result.cascaded });
  }
  return result;
}

/** Tick: counts down cascade outages and marks the network dirty when one expires. */
export function tickGrid(engine: SimulationEngine): void {
  let changed = false;
  for (const b of engine.buildings.values()) {
    if (b.offline <= 0) continue;
    b.offline--;
    engine.buildings.touch(b);
    if (b.offline === 0) changed = true;
  }
  if (changed) engine.networksDirty = true;
}

/** True when a district around tile `i` is currently stressed. */
export function isParched(engine: SimulationEngine, i: number): boolean {
  const size = engine.world.size;
  const x = engine.world.xOf(i);
  const y = engine.world.yOf(i);
  for (const anchor of engine.oasis.parched) {
    const ax = anchor % size;
    const ay = (anchor / size) | 0;
    if (Math.abs(ax - x) <= 8 && Math.abs(ay - y) <= 8) return true;
  }
  return false;
}

/** Battery banks and their mean charge 0..1, for the HUD and the report. */
export function cisternSummary(engine: SimulationEngine): { banks: number; charge: number } {
  const list = engine.oasis.cisterns;
  if (list.length === 0) return { banks: 0, charge: 0 };
  let sum = 0;
  for (const b of list) sum += b.charge;
  return { banks: list.length, charge: Math.round((sum / list.length) * 1000) / 1000 };
}
