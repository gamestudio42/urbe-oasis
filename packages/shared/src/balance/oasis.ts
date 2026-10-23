/**
 * Urbe Oasis balance: the desert ruleset. Kept apart from `BALANCE` so the classic
 * numbers stay byte for byte, and so a single place documents every new knob.
 *
 * Provenance of each formula lives in `docs/oasis-spec.md`; this file only holds constants.
 */

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
  /** Starting capital of each corporation. */
  startingCapital: 24000,
  /** A corporation buys a lot when it has at least this share of its capital free. */
  buyReserve: 0.35,
  /** Cash a corporation spends on one lot, as a share of its capital. */
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
  /** A corporation never buys a lot with this many residents or jobs. */
  maxOccupancy: 6,
  /** Fraction of tax revenue a corporate lot diverts from the city. */
  tradeShare: 0.12,
} as const;

/** Hackers: storms that take a service offline and windbreaks that stop them. */
export const OASIS_STORM = {
  /** Base chance per month of an intrusion attempt. */
  baseChance: 0.35,
  /** Chance added per 1000 residents. */
  populationChance: 0.12,
  /** Chance reduction per point of windbreak coverage (0..1). */
  windbreakMitigation: 0.75,
  /** Ticks a hacked service stays offline. */
  offlineTicks: 60,
  /** Cost and upkeep of a windbreak node. */
  windbreakCost: 900,
  windbreakUpkeep: 15,
  /** Radius of one windbreak node, in tiles. */
  windbreakRadius: 6,
  /** Cash a sandstorm takes. Sand buries services; it does not rob the treasury. */
  theft: 0,
  /** Highest chance an intrusion can reach, whatever the windbreak. */
  maxChance: 0.8,
} as const;

/** Drone traffic: a separate aerial layer above the roads. */
export const OASIS_ARCADE = {
  /** Drones a single drone port supports. */
  perPort: 4,
  /** Cost and upkeep of a drone port. */
  portCost: 1600,
  portUpkeep: 30,
  /** Tiles a drone crosses per tick of simulated traffic. */
  tilesPerTick: 2,
  /** Share of a road's traffic that drones relieve while a port is online. */
  relief: 0.15,
  /** Vertical clearance of the drone lanes, in sprite pixels. */
  altitude: 34,
} as const;

/**
 * Data network: springHouses and edge nodes supply bandwidth, canal conducts it.
 * A lot without a link stops at `maxLevelWithoutShade`, the same cap as a lot without water.
 */
export const OASIS_SHADE = {
  springCost: 1000,
  /**
   * Monthly upkeep of one hall, booked on the power line.
   * Eight and then four per hall left seed 2 of `oasis-balanced` in debt at month 120.
   * One per hall is the highest step on that ladder that closes all three seeds.
   */
  springUpkeep: 1,
  /** Power one hall draws, online or hacked. A pair draws the same 40 as the old single hall. */
  springPowerUse: 20,
  /**
   * Bandwidth while the hall is powered, online and watered (the water network reached it;
   * the hall itself does not consume water). One hall is short of the reference town.
   * Two halls cover it, and a hack leaves only the far side dark.
   */
  springSupply: 400,
  /** Bandwidth while powered and online but not reached by water. Thirty percent of the cooled output. */
  springSupplyDry: 120,
  /** Jobs, so an intrusion can take the hall offline. Targeting is uniform, not weighted by this count. */
  springJobs: 10,
  palmCost: 250,
  palmUpkeep: 8,
  palmPowerUse: 0,
  /** Bandwidth of one edge node. It does not need cooling water. */
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
  /** Extra demand per level above the table. A level-7 shop exceeds one edge node. */
  shadePerLevel: 1.4,
  /** Highest level a lot reaches without shade or water. */
  maxLevelWithoutShade: 2,
  /** Chebyshev radius where a spring house still counts as standing on the spring. */
  springRadius: 20,
  /** Months between spring steps. The first month only records the position. */
  springMoveMonths: 6,
  /** Tiles the spring tries to move on its own schedule. */
  springStep: 5,
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

export const OASIS_BALANCE = {
  grid: OASIS_WATER,
  corps: OASIS_CARAVAN,
  intrusion: OASIS_STORM,
  drones: OASIS_ARCADE,
  vertical: OASIS_HEAT,
  data: OASIS_SHADE,
} as const;

export type OasisBalance = typeof OASIS_BALANCE;
