import type { PlaceableKind, ZoneBuildingKind } from '../types/buildings';

export type HubJobKind = 'commercial' | 'industrial';

export interface PlaceableSpec {
  size: number;
  cost: number;
  upkeep: number;
  /** Department whose funding scales upkeep and effect. */
  department: Department | null;
  powerSupply: number;
  powerUse: number;
  waterSupply: number;
  waterSupplyNearWater: number;
  pollution: number;
  serviceRadius: number;
  /** Base jobs added to C or I while the building operates (powered and intact). */
  jobs: number;
  jobKind: HubJobKind | null;
  /** Extra jobs per 1000 residents, split between operating hubs of the same kind. */
  jobsPer1000: number;
  maxJobs: number;
  minPopulation: number;
  requiresWater: boolean;
  requiresRoad: boolean;
  /** Links its road component to the region, like a road leaving the map. */
  gateway: boolean;
  /** Land value added (or removed) around the footprint while operating. */
  landValue: number;
  landValueRadius: number;
}

export const DEPARTMENTS = ['transport', 'police', 'fire', 'health', 'education'] as const;
export type Department = (typeof DEPARTMENTS)[number];

const placeable = (
  spec: Partial<PlaceableSpec> & Pick<PlaceableSpec, 'size' | 'cost' | 'upkeep'>,
): PlaceableSpec => ({
  department: null,
  powerSupply: 0,
  powerUse: 0,
  waterSupply: 0,
  waterSupplyNearWater: 0,
  pollution: 0,
  serviceRadius: 0,
  jobs: 0,
  jobKind: null,
  jobsPer1000: 0,
  maxJobs: 0,
  minPopulation: 0,
  requiresWater: false,
  requiresRoad: false,
  gateway: false,
  landValue: 0,
  landValueRadius: 0,
  ...spec,
});

export const PLACEABLE_SPECS: Record<PlaceableKind, PlaceableSpec> = {
  coalPlant: placeable({ size: 3, cost: 3000, upkeep: 60, powerSupply: 800, pollution: 120 }),
  gasPlant: placeable({ size: 2, cost: 1500, upkeep: 45, powerSupply: 400, pollution: 50 }),
  windTurbine: placeable({ size: 1, cost: 250, upkeep: 4, powerSupply: 60 }),
  waterPump: placeable({
    size: 2,
    cost: 400,
    upkeep: 15,
    powerUse: 10,
    waterSupply: 150,
    waterSupplyNearWater: 400,
  }),
  well: placeable({
    size: 1,
    cost: 100,
    upkeep: 4,
    powerUse: 2,
    waterSupply: 40,
    waterSupplyNearWater: 80,
  }),
  policeStation: placeable({
    size: 2,
    cost: 500,
    upkeep: 80,
    department: 'police',
    powerUse: 4,
    serviceRadius: 22,
  }),
  fireStation: placeable({
    size: 2,
    cost: 500,
    upkeep: 80,
    department: 'fire',
    powerUse: 4,
    serviceRadius: 20,
  }),
  school: placeable({
    size: 2,
    cost: 600,
    upkeep: 100,
    department: 'education',
    powerUse: 5,
    serviceRadius: 24,
  }),
  hospital: placeable({
    size: 2,
    cost: 800,
    upkeep: 120,
    department: 'health',
    powerUse: 6,
    serviceRadius: 26,
  }),
  park: placeable({ size: 1, cost: 50, upkeep: 2 }),
  marina: placeable({
    size: 3,
    cost: 2500,
    upkeep: 35,
    powerUse: 8,
    pollution: 15,
    jobs: 40,
    jobKind: 'industrial',
    jobsPer1000: 25,
    maxJobs: 200,
    minPopulation: 1000,
    requiresWater: true,
    requiresRoad: true,
    gateway: true,
    landValue: 30,
    landValueRadius: 6,
  }),
  qanat: placeable({
    size: 2,
    cost: 1600,
    upkeep: 25,
    powerUse: 6,
    waterSupply: 260,
    waterSupplyNearWater: 260,
    pollution: 2,
  }),
  cistern: placeable({ size: 1, cost: 1200, upkeep: 20 }),
  windbreak: placeable({ size: 1, cost: 900, upkeep: 15, powerUse: 2 }),
  arcade: placeable({
    size: 2,
    cost: 1600,
    upkeep: 30,
    powerUse: 6,
    jobs: 15,
    jobKind: 'commercial',
    jobsPer1000: 10,
    maxJobs: 90,
    requiresRoad: true,
  }),
  caravanserai: placeable({
    size: 2,
    cost: 5000,
    upkeep: 60,
    powerUse: 10,
    pollution: 8,
    jobs: 50,
    jobKind: 'commercial',
    jobsPer1000: 30,
    maxJobs: 400,
    requiresRoad: true,
    landValue: 20,
    landValueRadius: 5,
  }),
  // Costs mirror OASIS_SHADE. Supply is read from there so this spec stays a classic record.
  springHouse: placeable({
    size: 2,
    cost: 1000,
    upkeep: 1,
    powerUse: 20,
    jobs: 10,
  }),
  palm: placeable({
    size: 1,
    cost: 250,
    upkeep: 8,
  }),
  // Oasis era works: late-game projects with a high upkeep. Effects live in OASIS_ERA_WORKS.
  rechargeBasin: placeable({
    size: 3,
    cost: 30000,
    upkeep: 300,
    powerUse: 20,
    jobs: 20,
  }),
  grandBazaar: placeable({
    size: 3,
    cost: 50000,
    upkeep: 500,
    powerUse: 25,
    pollution: 6,
    jobs: 120,
    jobKind: 'commercial',
    jobsPer1000: 40,
    maxJobs: 600,
    requiresRoad: true,
    landValue: 40,
    landValueRadius: 10,
  }),
  palaceGarden: placeable({
    size: 3,
    cost: 80000,
    upkeep: 800,
    powerUse: 30,
    jobs: 40,
    landValue: 50,
    landValueRadius: 10,
  }),
  airport: placeable({
    size: 4,
    cost: 6000,
    upkeep: 70,
    powerUse: 16,
    pollution: 35,
    jobs: 60,
    jobKind: 'commercial',
    jobsPer1000: 50,
    maxJobs: 600,
    minPopulation: 2000,
    requiresRoad: true,
    gateway: true,
    landValue: -35,
    landValueRadius: 5,
  }),
};

type LevelTable = readonly [number, number, number, number, number, number];

export const ZONE_SPECS: Record<
  ZoneBuildingKind,
  { capacity: LevelTable; power: LevelTable; water: LevelTable; pollution: number }
> = {
  residential: {
    capacity: [0, 10, 30, 80, 180, 400],
    power: [0, 1, 2, 4, 7, 12],
    water: [0, 2, 4, 9, 18, 36],
    pollution: 0,
  },
  commercial: {
    capacity: [0, 4, 12, 30, 70, 150],
    power: [0, 3, 6, 10, 16, 25],
    water: [0, 2, 5, 10, 18, 30],
    pollution: 3,
  },
  industrial: {
    capacity: [0, 8, 20, 45, 90, 160],
    power: [0, 6, 12, 18, 25, 35],
    water: [0, 4, 8, 14, 20, 28],
    pollution: 18,
  },
};

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const BALANCE = {
  startingFunds: 20000,
  startingFundsByDifficulty: { easy: 20000, normal: 10000, hard: 5000 } satisfies Record<
    Difficulty,
    number
  >,
  map: { defaultSize: 128, maxHeight: 12 },
  costs: {
    road: 10,
    bridge: 50,
    powerLine: 5,
    powerLineOverWater: 15,
    pipe: 5,
    zoneLight: 5,
    zoneDense: 10,
    clearTrees: 2,
    plantTree: 3,
    demolishTile: 1,
    demolishPerLevel: 5,
    levelPerUnit: 5,
  },
  zones: { maxLevelLight: 2, maxLevelDense: 5, maxLevelWithoutWater: 2 },
  clock: { ticksPerDay: 4, daysPerMonth: 30, monthsPerYear: 12 },
  demand: {
    laborRate: 0.45,
    externalJobs: 30,
    taxNeutral: 7,
    taxSpan: 13,
    smoothing: 0.5,
    residential: {
      jobs: 0.7,
      quality: 0.3,
      tax: 0.5,
      housing: 0.6,
      qualityOffset: 0.15,
      naturalVacancy: 0.1,
    },
    commercial: {
      perCapita: 0.2,
      perIndustrialJob: 0.05,
      base: 2,
      market: 0.8,
      labor: 0.3,
      tax: 0.5,
    },
    industrial: { base: 30, perCapita: 0.25, market: 0.8, labor: 0.4, tax: 0.5, edgeBonus: 0.1 },
    /** C/I market numerator added per operating hub job (visitors and freight). */
    hubMarketPerJob: 2,
  },
  attractiveness: {
    residential: {
      access: 0.25,
      landValue: 0.2,
      services: 0.15,
      power: 0.15,
      water: 0.1,
      transport: 0.15,
      pollution: 0.25,
      crime: 0.2,
    },
    commercial: {
      access: 0.25,
      landValue: 0.2,
      transport: 0.15,
      power: 0.15,
      water: 0.1,
      services: 0.1,
      base: 0.05,
      crime: 0.15,
      pollution: 0.1,
    },
    industrial: {
      access: 0.25,
      transport: 0.2,
      power: 0.2,
      water: 0.05,
      cheapLand: 0.1,
      fireCover: 0.1,
      base: 0.1,
      crime: 0.1,
    },
  },
  growth: {
    spawnRate: 0.5,
    occupancyRate: 0.35,
    /** Residential occupancy target = capacity · clamp(base + attract·A + demand·D). */
    residentialOccupancy: { base: 0.6, attract: 0.4, demand: 0.5 },
    /** Job occupancy target = capacity · clamp(laborRatio) · clamp(base + attract·A). */
    jobOccupancy: { base: 0.6, attract: 0.4 },
    upgradeOccupancy: 0.8,
    upgradeDemand: 0.02,
    upgradeThresholds: [0, 0.3, 0.45, 0.55, 0.65, 1],
    /** Upgrade probability = upgradeRate · clamp(upgradeBias + upgradeDemandGain · D). */
    upgradeRate: 0.25,
    upgradeBias: 0.3,
    upgradeDemandGain: 2,
    downgradeOccupancy: 0.3,
    downgradeDemand: -0.2,
    downgradeRate: 0.2,
    decayAttractiveness: 0.15,
    conditionLoss: 10,
    conditionGain: 5,
    abandonEmptyMonths: 6,
    recoverAttractiveness: 0.35,
    recoverDemand: 0.2,
    recoverRate: 0.1,
    externalWorkers: 10,
  },
  traffic: {
    accessRadius: 3,
    roadCapacity: 200,
    shoppingRate: 0.25,
    nearCommute: 15,
    maxCommute: 50,
    /** Path search bound as a multiple of maxCommute; trips use any path within it. */
    searchFactor: 3,
    congestionThreshold: 0.6,
    congestionCost: 2,
    /** Weight of the new month in the congestion moving average. */
    congestionSmoothing: 0.5,
  },
  services: {
    tileSpread: 2,
    spreadFalloff: 0.15,
    localRadius: 3,
    unpoweredFactor: 0.5,
    parkRadius: 4,
    parkValue: 40,
  },
  influence: {
    pollution: {
      coal: 120,
      gas: 50,
      trafficFactor: 0.3,
      fire: 80,
      gain: 4,
      treeReduction: 4,
      parkReduction: 20,
    },
    landValue: {
      base: 60,
      waterBonus: 30,
      waterRadius: 3,
      perElevation: 3,
      perTree: 2,
      education: 0.1,
      health: 0.1,
      police: 0.05,
      roadAccess: 10,
      centerBonus: 40,
      pollution: 0.5,
      crime: 0.3,
      traffic: 0.1,
    },
    crime: { base: 40, perLevel: 12, abandoned: 90, police: 0.6 },
  },
  economy: {
    taxDefault: 7,
    taxMax: 20,
    residentialTax: 3.0,
    commercialTax: 4.0,
    industrialTax: 3.5,
    landValueBase: 0.6,
    upkeep: { road: 0.25, bridge: 1, powerLine: 0.05, pipe: 0.05 },
    bankruptcyMonths: 12,
  },
  fire: {
    /** Ticks of burning before a building is destroyed. */
    burnout: 100,
    /** Ticks of burning before a forest tile is consumed. */
    treeBurnout: 30,
    /** Chance per tick that a burning tile ignites a flammable orthogonal neighbour. */
    spread: 0.025,
    /** Relative flammability of a fully wooded tile (scaled by tree density / 3). */
    treeFlammability: 0.4,
    spreadCoverReduction: 0.8,
    extinguishBase: 0.002,
    extinguishCover: 0.05,
    /** Monthly chance that a building catches fire without coverage (disasters enabled). */
    ignitionPerBuilding: 0.0005,
    /** Condition lost per point of intensity when a fire is put out. */
    damagePerIntensity: 0.25,
  },
  disasters: {
    randomChancePerMonth: 0.015,
    floodDays: 30,
    /** The water rises during the first days of a flood, then stays until it recedes. */
    floodSpreadDays: 10,
    floodSpreadChance: 0.5,
    floodMaxTiles: 60,
    /** A tile floods when its elevation is at most this much above the shore it came from. */
    floodMaxRise: 1,
    floodDamagePerDay: 4,
    floodDestroyChancePerDay: 0.02,
    earthquakeRadius: 20,
    /** Chance that a building at the epicentre is hit; decreases linearly to the radius. */
    earthquakeStrength: 0.5,
    /** Share of hit buildings that collapse (the rest catch fire). */
    earthquakeCollapseShare: 0.6,
    /** Relative chance that a road or power line within the radius is cut. */
    earthquakeNetworkFactor: 0.3,
    crisisMonths: 12,
    crisisIndustrialFactor: 0.6,
    crisisRevenueFactor: 0.8,
    blackoutDays: 30,
    epidemicMonths: 6,
    epidemicResidentialFactor: 0.85,
    epidemicCommercialRevenue: 0.85,
  },
  history: { maxMonths: 240 },
} as const;

export const TICKS_PER_MONTH = BALANCE.clock.ticksPerDay * BALANCE.clock.daysPerMonth;
export const TICKS_PER_YEAR = TICKS_PER_MONTH * BALANCE.clock.monthsPerYear;

/** Simulation ticks per real second for each speed setting (index = speed). */
export const SPEED_TICKS_PER_SECOND = [0, 20, 40, 80] as const;
export type Speed = 0 | 1 | 2 | 3;
