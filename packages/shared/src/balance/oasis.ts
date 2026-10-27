/**
 * Urbe Oasis balance: the desert ruleset. Kept apart from `BALANCE` so the classic
 * numbers stay byte for byte, and so a single place documents every new knob.
 *
 * Provenance of each formula lives in `docs/oasis-spec.md`; this file only holds constants.
 */

/** Founding defaults only; saves and scripted simulation presets retain their own terrain. */
export const OASIS_TERRAIN = { water: 0.04, hills: 0.15, forest: 0.04, rivers: 0 } as const;

/** Water grid: qanats, cascading dry spells and cisterns. */
export const OASIS_WATER = {
  /** Water a qanat adds while it is powered. Same near a river or in open sand. */
  qanatSupply: 260,
  /** Share of a well or pump's output that survives when the tile has no shade. */
  evaporation: 0.55,
  /** Cost and upkeep of a qanat. */
  qanatCost: 1600,
  qanatUpkeep: 25,
  /** Cost and upkeep of a cistern bank. */
  cisternCost: 1200,
  cisternUpkeep: 20,
  /** Ticks a full cistern bank covers at its rated load. */
  cisternTicks: 240,
  /** Share of a cistern's stored energy released per tick while the grid is short. */
  cisternDischarge: 1 / 240,
  /**
   * Share of a bank a spare network fills per day since the bank was last settled: full in about
   * eight months. It used to be added once per network refresh, which took years in a steady
   * city and could be pumped by repeated construction.
   */
  cisternChargePerDay: 1 / 240,
  /** Days of charge one settlement may add at most (a month). */
  cisternChargeDaysCap: 30,
  /** Power a cistern bank can carry while discharging. */
  cisternOutput: 120,
  /** Demand above this fraction of supply starts degrading the district. */
  overloadThreshold: 0.9,
  /** Chance per day that an parched district blows a qanat. */
  cascadeChance: 0.08,
  /** Days a blown qanat stays dark. */
  cascadeOutageDays: 2,
  /** Share of a component's buildings that may lose power in one cascade. */
  cascadeShare: 0.35,
} as const;

/** Megacaravans: land-market agents that buy idle lots and distort land value. */
export const OASIS_CARAVAN = {
  count: 4,
  /** Starting capital of each caravan house. */
  startingCapital: 24000,
  /** A caravan house buys a lot when it has at least this share of its capital free. */
  buyReserve: 0.35,
  /** Cash a caravan house spends on one lot, as a share of its capital. */
  lotPrice: 0.18,
  /** Land value added around a corporate lot. */
  landValue: 26,
  landValueRadius: 5,
  /** Pollution a corporate tower adds. */
  pollution: 8,
  /** Monthly chance that each caravan expands. */
  expandChance: 0.5,
  /** Monthly chance that a caravan abandons one dry lot it owns. */
  leaveChance: 0.35,
  /** A caravan house never buys a lot with this many residents or jobs. */
  maxOccupancy: 6,
  /** Fraction of tax revenue a corporate lot diverts from the city. */
  tradeShare: 0.12,
} as const;

/** Sandstorms that bury a service, and the windbreaks that slow them. */
export const OASIS_STORM = {
  /** Base chance per month of a sandstorm reaching a service. */
  baseChance: 0.35,
  /** Chance added per 1000 residents. */
  populationChance: 0.12,
  /** Chance reduction per point of windbreak coverage (0..1). */
  windbreakMitigation: 0.75,
  /** Ticks a buried service stays offline. */
  offlineTicks: 60,
  /** Cost and upkeep of a windbreak node. */
  windbreakCost: 900,
  windbreakUpkeep: 15,
  /** Radius of one windbreak node, in tiles. */
  windbreakRadius: 6,
  /** Cash a sandstorm takes. Sand buries services; it does not rob the treasury. */
  theft: 0,
  /** Highest chance a sandstorm can reach, whatever the windbreak. */
  maxChance: 0.8,
} as const;

/** Arcades: covered streets that ease the traffic beside them. */
export const OASIS_ARCADE = {
  /** Legacy drone capacity of one arcade; the adobe city draws no drones. */
  perPort: 4,
  /** Cost and upkeep of an arcade. */
  portCost: 1600,
  portUpkeep: 30,
  /** Legacy drone speed, in tiles per tick of simulated traffic (cyber skin only). */
  tilesPerTick: 2,
  /** Share of a road's traffic an online arcade relieves. */
  relief: 0.15,
  /** Vertical clearance of drone lanes in the cyber skin, in sprite pixels. */
  altitude: 34,
} as const;

/**
 * Shade network: spring houses and palms supply shade, canals and buildings conduct it.
 * A lot without a link stops at `maxLevelWithoutShade`, the same cap as a lot without water.
 */
export const OASIS_SHADE = {
  springCost: 1000,
  /**
   * Monthly upkeep of one spring house, booked on the power line.
   * Eight and then four per spring house left seed 2 of `oasis-balanced` in debt at month 120.
   * One per spring house is the highest step on that ladder that closes all three seeds.
   */
  springUpkeep: 1,
  /** Power one spring house draws, online or buried. A pair draws 40. */
  springPowerUse: 20,
  /**
   * Shade while the spring house is powered, online and watered (the water network reached it;
   * the spring house itself does not consume water). One is short of the reference town.
   * Two cover it, and a buried one leaves only the far side dark.
   */
  springSupply: 400,
  /** Shade while powered and online but not reached by water: thirty percent of the full output. */
  springSupplyDry: 120,
  /** Jobs, so a sandstorm can bury the spring house. Targeting is uniform, not weighted by this count. */
  springJobs: 10,
  palmCost: 250,
  palmUpkeep: 8,
  palmPowerUse: 0,
  /** Shade of one planted palm. It needs neither power nor water. */
  palmSupply: 80,
  canalCost: 5,
  /** Monthly upkeep of one canal tile. Booked with power, only when canal exists. */
  canalUpkeep: 0.05,
  /** Demand at levels 0..5. Level 5 is the last row before the spires extrapolate. */
  demand: {
    residential: [0, 1, 2, 4, 8, 14],
    commercial: [0, 3, 8, 16, 28, 48],
    industrial: [0, 2, 5, 10, 16, 24],
  },
  /** Extra demand per level above the table. A level-7 shop exceeds one palm. */
  shadePerLevel: 1.4,
  /** Highest level a lot reaches without shade or water. */
  maxLevelWithoutShade: 2,
  /** Chebyshev radius where a spring house still counts as standing on the spring. */
  springRadius: 20,
  /** Months between spring steps. The first month only records the position. */
  springMoveMonths: 6,
  /** Tiles the spring tries to move on its own schedule. */
  springStep: 5,
  /**
   * Chebyshev range around the map centre that the spring never leaves on its own: a step that
   * would go further turns back. Without it the random walk carried the spring 35 tiles in ten
   * years and stranded every spring house built around it.
   */
  springRange: 8,
} as const;

/**
 * Highest building level a save may store. Gameplay stops at `OASIS_HEAT.maxLevelDense`;
 * the extra room keeps a file that already holds a taller lot.
 */
export const OASIS_SAVE_MAX_LEVEL = 7;

/** Heat: how tall an oasis lot may grow. Adobe stays low; shade is what lifts the cap. */
export const OASIS_HEAT = {
  /** Level a dense zone can reach when it has water and shade. */
  maxLevelDense: 5,
  /** Level a light zone can reach in the oasis ruleset. */
  maxLevelLight: 2,
  /** Extra capacity per level above the classic table, as a multiplier. */
  capacityPerLevel: 1.35,
  /** Extra power demand per level above the classic table. */
  powerPerLevel: 1.2,
  /** Extra water demand per level above the classic table. */
  waterPerLevel: 1.15,
} as const;

/** Emergency conservation trades water demand for business tax receipts. */
export const OASIS_RATIONING = {
  demandMultiplier: 0.75,
  businessRevenuePenalty: 0.2,
} as const;

/**
 * Journey: five chapters after the founding tutorial, checked at each month close.
 * Rewards land in the treasury after the monthly budget. See docs/oasis-spec.md, "Journey".
 */
export const OASIS_JOURNEY = {
  /** Chapter 1: residents needed, with water and shade each serving this share of consumers. */
  residents: 100,
  servedShare: 0.8,
  /**
   * Chapter 2: this many powered cisterns at least `reserveCharge` full, with water still serving
   * `servedShare`. Cisterns charge only from spare water, about an eighth of a bank a month.
   */
  reserveBanks: 2,
  reserveCharge: 0.25,
  /** Chapter 3: share of services under windbreak cover. */
  shelter: 0.5,
  /** Chapter 5: an operating caravanserai (staffed, powered and on a road). */
  /** Treasury grant for each chapter, in order. The drought grant is the one for holding on. */
  rewards: [2000, 2500, 3000, 5000, 4000],
  /** Drought grant when water service averaged below `droughtTarget`. */
  droughtShortReward: 1000,
  /** Month closes the drought lasts, after a month of warning. */
  droughtMonths: 3,
  /** Share of well and pump output left during the drought. Qanats and cisterns are spared. */
  droughtFactor: 0.6,
  /** Mean water service across the drought's month closes that counts as holding on. */
  droughtTarget: 0.75,
} as const;

/** Chapters in the journey; `chapter === JOURNEY_CHAPTERS` means it is complete. */
export const JOURNEY_CHAPTERS = 5;

/**
 * The era: what an Oasis city faces after the journey. Ranks reward growth that stays served;
 * dry seasons come back on a calendar and grow longer and harsher. No random draws.
 * See docs/oasis-spec.md, "Era".
 */
export const OASIS_ERA = {
  /** Each rank's goals, checked at the month close in order, and its treasury grant. */
  ranks: [
    { residents: 1500, water: 0.85, shade: 0.8, shelter: 0.5, banks: 0, charge: 0, reward: 5000 },
    {
      residents: 4000,
      water: 0.9,
      shade: 0.85,
      shelter: 0.6,
      banks: 3,
      charge: 0.5,
      reward: 10000,
    },
    {
      residents: 8000,
      water: 0.9,
      shade: 0.9,
      shelter: 0.75,
      banks: 5,
      charge: 0.5,
      reward: 20000,
    },
  ],
  /** Months after the journey ends before the first dry season's warning month. */
  firstDroughtAfter: 18,
  /** Months from the end of one dry season to the warning month of the next. */
  droughtEvery: 24,
  /** Well and pump output left in the n-th era dry season: `max(floor, start - step * n)`. */
  droughtFactorStart: 0.55,
  droughtFactorStep: 0.05,
  droughtFactorFloor: 0.35,
  /**
   * Share of an era dry season's cut that also reaches qanats: long droughts lower the water
   * table. The journey's first drought spares qanats, which is how it teaches their value.
   */
  qanatShare: 0.5,
  /** Month closes the n-th era dry season lasts: `min(longest, shortest + floor(n / 2))`. */
  droughtShortest: 3,
  droughtLongest: 6,
  /** Mean water service that counts as holding on. */
  droughtTarget: 0.75,
  /** Grant for holding on through the n-th era dry season: `base + step * n`. */
  droughtRewardBase: 3000,
  droughtRewardStep: 1500,
} as const;

/** Ranks of the era; `rank === ERA_RANKS` means every rank is reached. */
export const ERA_RANKS = OASIS_ERA.ranks.length;

/** Every Oasis balance table, by system. */
export const OASIS_BALANCE = {
  water: OASIS_WATER,
  caravans: OASIS_CARAVAN,
  sandstorms: OASIS_STORM,
  arcades: OASIS_ARCADE,
  heights: OASIS_HEAT,
  shade: OASIS_SHADE,
  journey: OASIS_JOURNEY,
  era: OASIS_ERA,
  rationing: OASIS_RATIONING,
} as const;

export type OasisBalance = typeof OASIS_BALANCE;
