import { OASIS_RATIONING, TICKS_PER_MONTH, type CityStats } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { waterDemand } from '../utilities';

/** Time-weighted monthly business penalty. Switching off cannot erase accrued cost. */
export function rationingPenalty(engine: SimulationEngine): number {
  if (engine.ruleset !== 'oasis') return 0;
  return (
    (OASIS_RATIONING.businessRevenuePenalty * (engine.oasis.waterPolicy?.rationedTicks ?? 0)) /
    TICKS_PER_MONTH
  );
}

/** Exact current-lot demand alternatives, including per-lot integer rounding. No mutations. */
export function rationingSummary(
  engine: SimulationEngine,
): NonNullable<CityStats['oasis']>['waterPolicy'] {
  let normalDemand = 0;
  let rationedDemand = 0;
  for (const b of engine.buildings.values()) {
    normalDemand += waterDemand(b);
    rationedDemand += waterDemand(b, true);
  }
  return {
    enabled: engine.oasis.waterPolicy?.rationing ?? false,
    normalDemand,
    rationedDemand,
    fullMonthPenalty: OASIS_RATIONING.businessRevenuePenalty,
    accruedPenalty: rationingPenalty(engine),
  };
}
