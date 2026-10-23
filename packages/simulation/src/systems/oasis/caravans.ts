import {
  CARAVAN_NAMES,
  OASIS_CARAVAN,
  isZoneKind,
  type BuildingRecord,
} from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { monthIndex } from '../../time';

/**
 * Megacaravans (neon ruleset).
 *
 * Each corporation is an agent with cash, a preferred quadrant and a portfolio. Once a month it
 * looks for a vacant lot inside its quadrant and buys it: the lot keeps its kind and level, gains
 * an `owner`, and the corporation stamps extra land value around its new property.
 *
 * Nothing new is spawned, so the classic growth pipeline keeps running untouched; the corporation
 * only takes over lots the city failed to fill.
 */

/** Result of one caravan pass, for the report. */
export interface CaravanResult {
  /** Lots bought this month. */
  bought: number;
  /** Caravans founded on this pass (only the first one). */
  founded: number;
  /** Cash the purchases paid into the city treasury. */
  trade: number;
  /** Dry lots abandoned this month. */
  left: number;
}

/** Founds the caravans once; returns how many were created. */
export function initCaravans(engine: SimulationEngine): number {
  const state = engine.oasis;
  if (state.caravans.length > 0) return 0;
  for (let k = 0; k < OASIS_CARAVAN.count; k++) {
    state.caravans.push({
      id: k + 1,
      name: CARAVAN_NAMES[k % CARAVAN_NAMES.length] as string,
      capital: OASIS_CARAVAN.startingCapital,
      quadrant: k % 4,
      holdings: 0,
    });
  }
  return state.caravans.length;
}

/**
 * Monthly: each corporation may buy one vacant lot in its quadrant. Caravans act in id order
 * and scan lots in index order, so the RNG stream stays reproducible for a given seed.
 */
export function updateCaravans(engine: SimulationEngine): CaravanResult {
  const result: CaravanResult = { bought: 0, founded: 0, trade: 0, left: 0 };
  const month = monthIndex(engine.tick);
  if (engine.oasis.caravans.length === 0) result.founded = initCaravans(engine);
  if (engine.oasis.lastCaravanMonth === month) return result;
  engine.oasis.lastCaravanMonth = month;

  for (const corp of engine.oasis.caravans) {
    if (corp.capital < OASIS_CARAVAN.startingCapital * OASIS_CARAVAN.buyReserve) continue;
    if (!engine.rng.chance(OASIS_CARAVAN.expandChance)) continue;
    const lot = findLot(engine, corp.quadrant);
    if (!lot) continue;
    const price = Math.round(corp.capital * OASIS_CARAVAN.lotPrice);
    corp.capital -= price;
    corp.holdings++;
    lot.owner = corp.id;
    engine.buildings.touch(lot);
    // The premium the corporation charges the city for "redeveloping" the lot.
    const fee = Math.round(price * OASIS_CARAVAN.tradeShare);
    engine.economy.funds += fee;
    engine.oasis.trade += fee;
    result.trade += fee;
    engine.emit({ type: 'caravanTrade', caravan: corp.id, x: lot.x, y: lot.y });
    stampLandValue(engine, lot);
    result.bought++;
  }
  releaseDryLots(engine, result);
  return result;
}

/** First vacant zoned lot in a quadrant: nobody lives or works there yet and no one owns it. */
function findLot(engine: SimulationEngine, quadrant: number): BuildingRecord | null {
  const w = engine.world;
  const half = Math.floor(w.size / 2);
  const minX = quadrant % 2 === 0 ? 0 : half;
  const minY = quadrant < 2 ? 0 : half;
  const maxX = minX + half;
  const maxY = minY + half;
  for (const b of engine.buildings.values()) {
    // Only zoned land is for sale: the city keeps its plants, pumps and network nodes.
    if (!isZoneKind(b.kind)) continue;
    if (b.owner !== undefined || b.abandoned) continue;
    if (b.x < minX || b.y < minY || b.x >= maxX || b.y >= maxY) continue;
    // Caravans buy a lot that already has water or shade. Dry sand is not for sale.
    if (b.watered !== true && b.linked !== true) continue;
    // Homes with people and shops with customers are not for sale; a vacant lot is.
    if (b.occupancy > OASIS_CARAVAN.maxOccupancy) continue;
    if (b.capacity > OASIS_CARAVAN.maxOccupancy && b.occupancy > 2) continue;
    return b;
  }
  return null;
}

/** Drops one dry owned lot per caravan. A watered or shaded lot stays. */
function releaseDryLots(engine: SimulationEngine, result: CaravanResult): void {
  for (const corp of engine.oasis.caravans) {
    if (corp.holdings <= 0) continue;
    if (!engine.rng.chance(OASIS_CARAVAN.leaveChance)) continue;
    const lot = findOwnedDry(engine, corp.id);
    if (!lot) continue;
    delete lot.owner;
    engine.buildings.touch(lot);
    corp.holdings = Math.max(0, corp.holdings - 1);
    result.left++;
    engine.emit({ type: 'caravanLeave', caravan: corp.id, x: lot.x, y: lot.y });
  }
}

function findOwnedDry(engine: SimulationEngine, id: number): BuildingRecord | null {
  for (const b of engine.buildings.values()) {
    if (b.owner !== id || !isZoneKind(b.kind)) continue;
    if (b.watered === true || b.linked === true) continue;
    return b;
  }
  return null;
}

/** Adds land value around a caravan lot; the influence pass averages it out again. */
function stampLandValue(engine: SimulationEngine, b: BuildingRecord): void {
  const w = engine.world;
  const radius = OASIS_CARAVAN.landValueRadius;
  for (let y = b.y - radius; y < b.y + b.h + radius; y++) {
    for (let x = b.x - radius; x < b.x + b.w + radius; x++) {
      if (!w.inBounds(x, y)) continue;
      const d = Math.max(
        Math.max(b.x - x, x - (b.x + b.w - 1), 0),
        Math.max(b.y - y, y - (b.y + b.h - 1), 0),
      );
      const add = Math.round(OASIS_CARAVAN.landValue * (1 - d / (radius + 1)));
      if (add <= 0) continue;
      const i = w.index(x, y);
      w.influence.landValue[i] = Math.min(255, (w.influence.landValue[i] as number) + add);
      w.markDirty(i);
    }
  }
}

/** Name of the corporation that owns a lot, or null for city-owned property. */
export function ownerOf(engine: SimulationEngine, b: BuildingRecord): string | null {
  if (b.owner === undefined) return null;
  return engine.oasis.caravans.find((c) => c.id === b.owner)?.name ?? null;
}
