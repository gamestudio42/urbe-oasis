import { TICKS_PER_MONTH, type CityStats } from '@city/shared';
import type { MusicMood } from './sound';

/** A sandstorm colours the score for half a month of game time. */
export const STORM_MOOD_TICKS = Math.round(TICKS_PER_MONTH / 2);
const SCARCE_SERVICE = 0.75;
const PROSPEROUS = { residents: 300, water: 0.9, shade: 0.8 } as const;

/**
 * The music's reading of the city, from the statistics the HUD already shows. A storm outranks
 * scarcity, which outranks prosperity. Cities without oasis telemetry stay calm.
 */
export function cityMood(stats: CityStats | null, stormUntilTick: number): MusicMood {
  const oasis = stats?.oasis;
  if (!stats || !oasis) return 'calm';
  // A window from another city (loaded later at an earlier tick) is ignored.
  if (stats.tick < stormUntilTick && stormUntilTick - stats.tick <= STORM_MOOD_TICKS)
    return 'storm';
  const water = stats.water;
  const dry = water.demand > 0 && water.served < SCARCE_SERVICE;
  const drought =
    (oasis.journey?.droughtMonthsLeft ?? 0) > 0 || (oasis.journey?.era?.droughtMonthsLeft ?? 0) > 0;
  if (drought || oasis.parched > 0 || dry) return 'scarce';
  if (
    stats.population >= PROSPEROUS.residents &&
    stats.lastMonth.net > 0 &&
    water.served >= PROSPEROUS.water &&
    oasis.data.served >= PROSPEROUS.shade
  )
    return 'prosperous';
  return 'calm';
}
