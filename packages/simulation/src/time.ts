import { BALANCE, TICKS_PER_MONTH } from '@city/shared';

export const START_YEAR = 2000;

export interface CityDate {
  day: number;
  month: number;
  year: number;
}

export function dateOf(tick: number): CityDate {
  const { ticksPerDay, daysPerMonth, monthsPerYear } = BALANCE.clock;
  const totalDays = Math.floor(tick / ticksPerDay);
  const totalMonths = Math.floor(totalDays / daysPerMonth);
  return {
    day: (totalDays % daysPerMonth) + 1,
    month: totalMonths % monthsPerYear,
    year: START_YEAR + Math.floor(totalMonths / monthsPerYear),
  };
}

export function monthIndex(tick: number): number {
  return Math.floor(tick / TICKS_PER_MONTH);
}

export function isDayStart(tick: number): boolean {
  return tick % BALANCE.clock.ticksPerDay === 0;
}

export function isMonthStart(tick: number): boolean {
  return tick % TICKS_PER_MONTH === 0;
}

/**
 * Heavy monthly work is spread over the last ticks of each month (like the phases of the
 * classic simulation loop) so that no single tick pays for all of it. `close` is the first tick
 * of the next month, when demand, growth and the budget run on the stage results.
 */
export type MonthStage = 'traffic' | 'services' | 'influence' | 'close';

export function monthStage(tick: number): MonthStage | null {
  switch (tick % TICKS_PER_MONTH) {
    case 0:
      return 'close';
    case TICKS_PER_MONTH - 3:
      return 'traffic';
    case TICKS_PER_MONTH - 2:
      return 'services';
    case TICKS_PER_MONTH - 1:
      return 'influence';
    default:
      return null;
  }
}

export function isYearStart(tick: number): boolean {
  return tick % (TICKS_PER_MONTH * BALANCE.clock.monthsPerYear) === 0;
}
