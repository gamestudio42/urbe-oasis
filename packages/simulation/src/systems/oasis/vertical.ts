import { OASIS_SHADE, OASIS_HEAT, ZONE_SPECS, type ZoneBuildingKind } from '@city/shared';

/**
 * Building heights (oasis ruleset).
 *
 * Classic cities cap a dense zone at level 5. An oasis city keeps that cap and will not pass
 * level 2 without water and shade. Levels past the classic table still extrapolate, so a saved
 * taller lot keeps a defined capacity.
 *
 * The functions take an `oasis` flag instead of the engine so the pure growth helpers can stay free
 * of the engine type, which also keeps them usable from the UI inspector.
 */

/**
 * Highest level a zone may reach, or `classicCap` for a classic city. `density` is the raw
 * `ZoneDensity` value (2 = dense).
 */
export function oasisMaxLevel(
  density: number,
  watered: boolean,
  oasis: boolean,
  classicCap: number,
  linked = true,
): number {
  if (!oasis) return classicCap;
  const cap = density >= 2 ? OASIS_HEAT.maxLevelDense : OASIS_HEAT.maxLevelLight;
  if (!watered || !linked) return Math.min(cap, OASIS_SHADE.maxLevelWithoutShade);
  return cap;
}

/** Capacity of a zone at a level, extrapolating past the classic table when needed. */
export function oasisCapacity(kind: ZoneBuildingKind, level: number): number {
  const table = ZONE_SPECS[kind].capacity;
  if (level < table.length) return table[level] as number;
  const last = table[table.length - 1] as number;
  const extra = level - (table.length - 1);
  return Math.round(last * OASIS_HEAT.capacityPerLevel ** extra);
}

/** Power demand of a zone at a level, extrapolating past the classic table. */
export function oasisPower(kind: ZoneBuildingKind, level: number): number {
  const table = ZONE_SPECS[kind].power;
  if (level < table.length) return table[level] as number;
  const last = table[table.length - 1] as number;
  const extra = level - (table.length - 1);
  return Math.round(last * OASIS_HEAT.powerPerLevel ** extra);
}

/** Water demand of a zone at a level, extrapolating past the classic table. */
export function oasisWater(kind: ZoneBuildingKind, level: number): number {
  const table = ZONE_SPECS[kind].water;
  if (level < table.length) return table[level] as number;
  const last = table[table.length - 1] as number;
  const extra = level - (table.length - 1);
  return Math.round(last * OASIS_HEAT.waterPerLevel ** extra);
}

/** Shade demand of a zone at a level. Exact on the table, extrapolated past it. */
export function oasisShade(kind: ZoneBuildingKind, level: number): number {
  const table = OASIS_SHADE.demand[kind];
  if (level < table.length) return table[level] as number;
  const last = table[table.length - 1] as number;
  const extra = level - (table.length - 1);
  return Math.round(last * OASIS_SHADE.shadePerLevel ** extra);
}

/**
 * Vertical scale of a lot, 1 for a classic tower and up to ~1.6 for a lot past level 5. The renderer
 * multiplies a sprite's height by it; nothing in the simulation depends on the number.
 */
export function verticalScale(level: number, oasis: boolean): number {
  if (!oasis) return 1;
  const extra = Math.max(0, level - 5);
  return Math.round((1 + extra * 0.15) * 100) / 100;
}
