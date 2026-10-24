export { GAME_NAME } from '@city/shared';
export {
  planToolCommand,
  DemolishOp,
  footprintTouches,
  type PlanContext,
  type ToolPlan,
} from './commands/plan';
export { lPath, normalizeArea, rectTiles } from './commands/shapes';
export {
  createEngine,
  SimulationEngine,
  type EngineOptions,
  type LoggedCommand,
  type System,
} from './engine';
export { diagnoseTile, type DiagnoseContext } from './diagnostics';
export {
  explainService,
  isServiceSource,
  serviceNetworkOf,
  traceService,
  type ServiceContext,
  type ServiceExplanation,
  type ServiceNetwork,
  type ServicePlan,
  type ServiceStatus,
  type ServiceTrace,
  type SourceIssue,
  type TracedSource,
} from './serviceTrace';
export { hashSnapshot, hashState, hashTerrain } from './persistence/hash';
export { collectMetrics, type MonthMetrics } from './report';
export {
  addServices,
  buildCorridor,
  buildTown,
  flatCity,
  maintainTown,
  recoverCity,
  run,
  type CityLayout,
} from './scenarios/builders';
export { buildGridCity, maintainGrid, type GridLayout } from './scenarios/grid';
export { SIM_PRESETS, type PresetRun, type SimPreset } from './scenarios/presets';
export {
  cityTotals,
  demandTargets,
  hubJobs,
  taxPressure,
  type CityTotals,
  type DemandInputs,
} from './systems/demand';
export { attractiveness, maxLevel, transportScore, ZONE_KIND } from './systems/growth';
export { boxBlur, populationCentre } from './systems/influence';
export {
  cisternSummary,
  cascade,
  isParched,
  tickGrid,
  updateGrid,
  type GridResult,
} from './systems/oasis/grid';
export {
  initCaravans,
  ownerOf,
  updateCaravans,
  type CaravanResult,
} from './systems/oasis/caravans';
export {
  shelterCoverage,
  windbreakCoverage,
  activeStorm,
  tickStorms,
  updateStorms,
  STORM_KINDS,
  type StormKind,
  type StormResult,
} from './systems/oasis/intrusion';
export {
  ARCADE_LANE_CAP,
  arcadeCapacity,
  arcadeLanes,
  arcadeRelief,
  arcadeRoadLanes,
  longestArcadeLane,
  arcadeCount,
  type ArcadeLane,
} from './systems/oasis/airTraffic';
export {
  oasisCapacity,
  oasisShade,
  oasisMaxLevel,
  oasisPower,
  oasisWater,
  verticalScale,
} from './systems/oasis/vertical';
export { RoadNetwork } from './systems/roads';
export { SERVICE_LAYERS, stationAccessRoads } from './systems/services';
export {
  commuteDecay,
  componentStats,
  gatewayRoads,
  hasDestination,
  hubRoad,
  isOperatingHub,
  regionalComponents,
  roadDijkstra,
  type TrafficResult,
} from './systems/traffic';
export {
  shadeDemand,
  shadeSupply,
  powerDemand,
  powerSupply,
  pumpNearWater,
  waterDemand,
  waterSupply,
} from './systems/utilities';
export { Rng, type RngState } from './rng/rng';
export { DEFAULT_TERRAIN, generateTerrain, relaxSlopes } from './terrain/generate';
export { FractalNoise, ValueNoise } from './terrain/noise';
export { dateOf, monthIndex, monthStage, START_YEAR, type CityDate, type MonthStage } from './time';
export { BuildingStore } from './world/buildings';
export { Connection, connectionMask } from './world/connections';
export { tileVariant } from './world/variant';
export { World } from './world/world';
