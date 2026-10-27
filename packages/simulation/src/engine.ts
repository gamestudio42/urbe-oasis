import {
  BALANCE,
  defaultJourneyState,
  defaultOasisState,
  Infra,
  isToolCommand,
  isZoneKind,
  type ActiveDisaster,
  type CityStats,
  type Command,
  type CommandPreview,
  type CommandResult,
  type DisasterKind,
  type EconomyState,
  type EngineSnapshot,
  type HistoryEntry,
  type Difficulty,
  type NewCityOptions,
  type RciValues,
  type Ruleset,
  type OasisState,
  type SimEvent,
  type TerrainOptions,
  type ToolCommand,
  rulesetOf,
} from '@city/shared';
import { CommandQueue, runSystems, runTicks, type System as KernelSystem } from '@shell/kernel';
import { applyToolPlan } from './commands/apply';
import { planToolCommand, type PlanContext } from './commands/plan';
import { applyPolicyCommand } from './commands/policy';
import { Rng } from './rng/rng';
import { cityTotals, round4, updateDemand, type CityTotals } from './systems/demand';
import {
  countFires,
  monthlyDisasters,
  triggerDisaster,
  updateDisasters,
  updateFires,
  type DestructionCause,
} from './systems/disasters';
import { applyMonthlyBudget, computeMonthlyReport, defaultEconomy } from './systems/economy';
import { updateGrowth, type GrowthResult } from './systems/growth';
import { updateInfluence } from './systems/influence';
import { RoadNetwork } from './systems/roads';
import { updateServices } from './systems/services';
import { componentStats, gatewayRoads, updateTraffic, type TrafficResult } from './systems/traffic';
import { updateUtilities, type UtilityResult } from './systems/utilities';
import { refreshGrid, tickGrid, updateGrid, type GridResult } from './systems/oasis/grid';
import { updateCaravans, type CaravanResult } from './systems/oasis/caravans';
import { ensureSpring, updateSpring } from './systems/oasis/spring';
import { rationingSummary } from './systems/oasis/rationing';
import { journeySummary, updateJourney } from './systems/oasis/journey';
import { cisternSummary } from './systems/oasis/grid';
import { shelterCoverage } from './systems/oasis/sandstorms';
import { arcadeCount } from './systems/oasis/arcades';
import { tickStorms, updateStorms, type StormResult } from './systems/oasis/sandstorms';
import { DEFAULT_TERRAIN, generateTerrain } from './terrain/generate';
import { dateOf, isDayStart, monthIndex, monthStage } from './time';
import { BuildingStore } from './world/buildings';
import { World } from './world/world';

export { defaultEconomy, emptyReport } from './systems/economy';

export interface EngineOptions {
  name?: string;
  seed: string | number;
  size?: number;
  terrain?: Partial<TerrainOptions>;
  /** Starting funds preset; defaults to `BALANCE.startingFunds`. */
  difficulty?: Difficulty;
  /** Explicit starting funds (overrides the difficulty). */
  funds?: number;
  /** Rules of the simulation; defaults to `classic` (Urbe). */
  ruleset?: Ruleset;
  /** Oasis only: follow the post-tutorial journey. */
  journey?: boolean;
}

export function createEngine(options: NewCityOptions | EngineOptions): SimulationEngine {
  return SimulationEngine.create(options);
}

export interface LoggedCommand {
  tick: number;
  command: Command;
}

/** A custom system run every tick after the built-in pipeline (used by tests and tools). */
export type System = KernelSystem<SimulationEngine>;

const MILESTONES = [100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000] as const;
const MAX_PENDING_EVENTS = 500;

interface LayerStats {
  avgCongestion: number;
  averages: CityStats['averages'];
  coverage: CityStats['coverage'];
}

export class SimulationEngine {
  readonly world: World;
  readonly buildings: BuildingStore;
  readonly rng: Rng;
  readonly seed: string;
  /** Rules this city runs; new systems read it, the classic pipeline ignores it. */
  readonly ruleset: Ruleset;
  readonly roads: RoadNetwork;
  name: string;
  tick = 0;
  economy: EconomyState = defaultEconomy();
  demand: RciValues = { residential: 0, commercial: 0, industrial: 0 };
  history: HistoryEntry[] = [];
  disasters: ActiveDisaster[] = [];
  disastersEnabled = true;
  networksDirty = true;
  lastMilestone = 0;
  /** Oasis systems state; empty for a classic city, which never reads it. */
  oasis: OasisState = defaultOasisState();
  historyDirty = false;

  /** Burning tiles, derived from the `fire` layer. */
  fireCount = 0;
  /** Buildings destroyed since this engine instance started (diagnostics only). */
  readonly losses: Record<DestructionCause, number> = { fire: 0, flood: 0, earthquake: 0 };

  /** Last results of the derived systems (not serialized; recomputed when needed). */
  lastTraffic: TrafficResult | null = null;
  lastGrowth: GrowthResult | null = null;
  /** Last Oasis results, for the HUD and reports; null in a classic city. */
  lastGrid: GridResult | null = null;
  lastCorps: CaravanResult | null = null;
  lastStorm: StormResult | null = null;
  private utilities: {
    power: UtilityResult;
    water: UtilityResult;
    data?: UtilityResult;
  } | null = null;
  private layerStats: LayerStats | null = null;
  private lastShortageMonth = -1;

  /** Served shares from the last utility solve (1 when nothing has been solved yet). */
  servedShares(): { water: number; shade: number } {
    return {
      water: this.utilities?.water.served ?? 1,
      shade: this.utilities?.data?.served ?? 1,
    };
  }

  readonly commandLog: LoggedCommand[] = [];
  private readonly queue = new CommandQueue<Command>();
  private pendingEvents: SimEvent[] = [];
  private readonly systems: System[] = [];

  private constructor(world: World, rng: Rng, seed: string, name: string, ruleset: Ruleset) {
    this.world = world;
    this.rng = rng;
    this.seed = seed;
    this.name = name;
    this.ruleset = ruleset;
    this.buildings = new BuildingStore(world);
    this.roads = new RoadNetwork(world);
  }

  static create(options: EngineOptions): SimulationEngine {
    const size = options.size ?? BALANCE.map.defaultSize;
    const seed = String(options.seed);
    const world = new World(size);
    const rng = Rng.fromSeed(seed);
    generateTerrain(world, rng.fork(), { ...DEFAULT_TERRAIN, ...options.terrain });
    const engine = new SimulationEngine(
      world,
      rng,
      seed,
      options.name ?? 'Nova Cidade',
      options.ruleset ?? 'classic',
    );
    engine.economy.funds =
      options.funds ??
      (options.difficulty
        ? BALANCE.startingFundsByDifficulty[options.difficulty]
        : BALANCE.startingFunds);
    if (engine.ruleset === 'oasis') ensureSpring(engine);
    if (engine.ruleset === 'oasis' && options.journey) engine.oasis.journey = defaultJourneyState();
    return engine;
  }

  static fromSnapshot(snapshot: EngineSnapshot): SimulationEngine {
    const world = new World(snapshot.size);
    world.heights.set(snapshot.heights);
    let sawLink = false;
    for (const [name, data] of Object.entries(snapshot.layers)) {
      if (name === 'linked') {
        world.linked.set(data);
        sawLink = true;
        continue;
      }
      const target =
        (world.structure as Record<string, Uint8Array>)[name] ??
        (world.influence as Record<string, Uint8Array>)[name];
      if (!target) throw new Error(`Unknown layer ${name}`);
      target.set(data);
    }
    const engine = new SimulationEngine(
      world,
      new Rng(snapshot.rng),
      snapshot.seed,
      snapshot.name,
      rulesetOf(snapshot.ruleset),
    );
    for (const record of snapshot.buildings) engine.buildings.restore(record);
    engine.buildings.nextId = snapshot.nextBuildingId;
    engine.tick = snapshot.tick;
    engine.economy = structuredCopy(snapshot.economy);
    engine.demand = { ...snapshot.demand };
    engine.history = snapshot.history.map((h) => ({ ...h }));
    engine.disasters = snapshot.disasters.map((d) => ({ ...d }));
    engine.disastersEnabled = snapshot.disastersEnabled;
    engine.networksDirty = snapshot.networksDirty || (engine.ruleset === 'oasis' && !sawLink);
    engine.lastMilestone = snapshot.lastMilestone;
    if (snapshot.oasis) engine.oasis = structuredCopy(snapshot.oasis);
    else if (engine.ruleset === 'oasis') engine.oasis = defaultOasisState();
    if (engine.ruleset === 'oasis') ensureSpring(engine);
    engine.fireCount = countFires(engine);
    world.markAllDirty();
    engine.buildings.takeChanges();
    return engine;
  }

  serialize(): EngineSnapshot {
    const layers = {} as EngineSnapshot['layers'];
    for (const [name, data] of Object.entries(this.world.structure)) {
      layers[name as keyof EngineSnapshot['layers']] = data.slice();
    }
    for (const [name, data] of Object.entries(this.world.influence)) {
      layers[name as keyof EngineSnapshot['layers']] = data.slice();
    }
    if (this.ruleset === 'oasis') layers.linked = this.world.linked.slice();
    return {
      name: this.name,
      ruleset: this.ruleset,
      seed: this.seed,
      size: this.world.size,
      tick: this.tick,
      rng: this.rng.getState(),
      heights: this.world.heights.slice(),
      layers,
      buildings: this.buildings.list().map((b) => ({ ...b })),
      nextBuildingId: this.buildings.nextId,
      economy: structuredCopy(this.economy),
      demand: { ...this.demand },
      history: this.history.map((h) => ({ ...h })),
      disasters: this.disasters.map((d) => ({ ...d })),
      disastersEnabled: this.disastersEnabled,
      networksDirty: this.networksDirty,
      lastMilestone: this.lastMilestone,
      ...(this.ruleset === 'oasis' ? { oasis: structuredCopy(this.oasis) } : {}),
    };
  }

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  emit(event: SimEvent): void {
    // Headless runs may never drain events; keep only the most recent ones.
    if (this.pendingEvents.length >= MAX_PENDING_EVENTS) this.pendingEvents.shift();
    this.pendingEvents.push(event);
  }

  takeEvents(): SimEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  /** Queues a command for the start of the next tick. */
  enqueue(command: Command): void {
    this.queue.enqueue(command);
  }

  /** Applies a command immediately (between ticks) and records it for replay. */
  execute(command: Command): CommandResult {
    this.commandLog.push({ tick: this.tick, command });
    return this.apply(command);
  }

  step(): void {
    this.queue.drain((command) => this.execute(command));
    // Networks only change through commands, growth and disasters, which all mark them dirty.
    if (isDayStart(this.tick) && this.networksDirty) this.refreshUtilities();
    updateFires(this);
    updateDisasters(this);
    if (this.ruleset === 'oasis') {
      if (this.oasis.waterPolicy?.rationing) this.oasis.waterPolicy.rationedTicks++;
      tickGrid(this);
      tickStorms(this);
    }
    runSystems(this.systems, this);
    this.tick++;
    // Stage outputs live in serialized layers, so a save between stages resumes identically.
    switch (monthStage(this.tick)) {
      case 'traffic':
        this.roads.update();
        this.lastTraffic = updateTraffic(this, this.roads);
        break;
      case 'services':
        updateServices(this);
        break;
      case 'influence':
        this.roads.update();
        updateInfluence(this, this.roads);
        break;
      case 'close':
        this.monthly();
        break;
    }
  }

  runTicks(count: number): void {
    runTicks(count, () => this.step());
  }

  /** Runs whole months (useful for tests and headless simulation). */
  runMonths(months: number): void {
    this.runTicks(months * BALANCE.clock.ticksPerDay * BALANCE.clock.daysPerMonth);
  }

  /** Validates a tool command against the current state without applying it. */
  preview(command: ToolCommand): CommandPreview {
    const { ok, cost, valid, invalid, reason } = planToolCommand(this.planContext(), command);
    return reason ? { ok, cost, valid, invalid, reason } : { ok, cost, valid, invalid };
  }

  planContext(): PlanContext {
    // Tool unlocks need only population. Hover previews must not aggregate jobs and quality.
    let population = 0;
    for (const b of this.buildings.values()) {
      if (b.kind === 'residential' && !b.abandoned) population += b.occupancy;
    }
    return {
      world: this.world,
      building: (id) => this.buildings.get(id),
      funds: this.economy.funds,
      bankrupt: this.economy.bankrupt,
      population,
      ruleset: this.ruleset,
      ...(this.ruleset === 'oasis' && this.oasis.journey?.era
        ? { eraRank: this.oasis.journey.era.rank }
        : {}),
      has: (kind) => this.buildings.ofKind(kind).length > 0,
    };
  }

  /** Starts a disaster on demand. Returns false when the disaster cannot start. */
  triggerDisaster(kind: DisasterKind, x?: number, y?: number): boolean {
    return triggerDisaster(this, kind, x, y);
  }

  hasDisaster(kind: DisasterKind): boolean {
    return this.disasters.some((d) => d.kind === kind);
  }

  totals(): CityTotals {
    return cityTotals(this);
  }

  stats(): CityStats {
    const date = dateOf(this.tick);
    const totals = cityTotals(this);
    const utilities = (this.utilities ??= updateUtilities(this, false));
    const layer = this.layerStats ?? (this.layerStats = computeLayerStats(this));
    const counts = {
      roads: 0,
      residential: 0,
      commercial: 0,
      industrial: 0,
      abandoned: 0,
      services: 0,
      plants: 0,
    };
    for (const b of this.buildings.values()) {
      if (isZoneKind(b.kind)) {
        if (b.abandoned) counts.abandoned++;
        else counts[b.kind]++;
      } else if (b.kind === 'coalPlant' || b.kind === 'gasPlant' || b.kind === 'windTurbine')
        counts.plants++;
      else if (b.kind !== 'waterPump' && b.kind !== 'well') counts.services++;
    }
    const w = this.world;
    let fires = 0;
    let edgeConnected = false;
    const size = w.size;
    for (let i = 0; i < w.tileCount; i++) {
      if ((w.fire[i] as number) > 0) fires++;
      if (w.hasInfra(i, Infra.Road)) {
        counts.roads++;
        const x = i % size;
        const y = (i / size) | 0;
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edgeConnected = true;
      }
    }
    const employed = Math.min(
      totals.workforce,
      totals.commercialWorkers + totals.industrialWorkers,
    );
    return {
      name: this.name,
      ruleset: this.ruleset,
      tick: this.tick,
      day: date.day,
      month: date.month,
      year: date.year,
      funds: this.economy.funds,
      population: totals.residents,
      housingCapacity: totals.housing,
      workforce: Math.round(totals.workforce),
      jobs: {
        residential: totals.housing,
        commercial: totals.commercialJobs,
        industrial: totals.industrialJobs,
      },
      employed: {
        residential: Math.round(employed),
        commercial: totals.commercialWorkers,
        industrial: totals.industrialWorkers,
      },
      unemployment:
        totals.workforce > 0
          ? round4(Math.max(0, totals.workforce - employed) / totals.workforce)
          : 0,
      demand: { ...this.demand },
      taxes: { ...this.economy.taxes },
      funding: { ...this.economy.funding },
      lastMonth: this.economy.lastMonth,
      power: utilityStats(utilities.power),
      water: utilityStats(utilities.water),
      avgCongestion: layer.avgCongestion,
      averages: layer.averages,
      coverage: layer.coverage,
      counts,
      monthsInDebt: this.economy.monthsInDebt,
      bankrupt: this.economy.bankrupt,
      activeFires: fires,
      disasters: this.disasters.map((d) => ({ ...d })),
      disastersEnabled: this.disastersEnabled,
      edgeConnected: edgeConnected || this.hasGateway(),
      ...(this.ruleset === 'oasis' ? { oasis: this.oasisStats() } : {}),
    };
  }

  /** Oasis telemetry for the HUD and the report. */
  private oasisStats(): NonNullable<CityStats['oasis']> {
    const journey = journeySummary(this);
    let holdings = 0;
    for (const c of this.oasis.caravans) holdings += c.holdings;
    return {
      waterPolicy: rationingSummary(this),
      parched: this.oasis.parched.length,
      cisterns: cisternSummary(this),
      windbreak: shelterCoverage(this),
      arcades: arcadeCount(this),
      caravans: { count: this.oasis.caravans.length, holdings },
      trade: Math.round(this.oasis.trade),
      data: {
        supply: this.utilities?.data?.supply ?? 0,
        demand: this.utilities?.data?.demand ?? 0,
        served: this.utilities?.data ? round4(this.utilities.data.served) : 1,
      },
      spring: { x: this.oasis.springX, y: this.oasis.springY },
      ...(journey ? { journey } : {}),
    };
  }

  /** Some operating airport or marina links the city to the region. */
  private hasGateway(): boolean {
    this.roads.update();
    return gatewayRoads(this.world, this.roads, this.buildings.values()).length > 0;
  }

  /** Recomputes power and water networks now. */
  refreshUtilities(): void {
    const result = updateUtilities(this);
    this.utilities = result;
    this.networksDirty = false;
    if (this.ruleset === 'oasis') {
      this.lastGrid = refreshGrid(this, result.water);
    }
    const month = monthIndex(this.tick);
    if ((result.power.shortage || result.water.shortage) && month !== this.lastShortageMonth) {
      this.lastShortageMonth = month;
      if (result.power.shortage) this.emit({ type: 'brownout' });
      if (result.water.shortage) this.emit({ type: 'waterShortage' });
    }
  }

  private monthly(): void {
    this.roads.update();
    const crisis = this.hasDisaster('crisis');
    const epidemic = this.hasDisaster('epidemic');
    const d = BALANCE.disasters;
    const before = cityTotals(this);
    updateDemand(this, {
      totals: before,
      taxes: this.economy.taxes,
      edgeConnected: this.roads.edgeRoads.length > 0 || this.hasGateway(),
      crisis: crisis ? d.crisisIndustrialFactor : 1,
    });
    const healthCover = epidemic ? computeLayerStats(this).coverage.health : 0;
    this.lastGrowth = updateGrowth(this, {
      totals: before,
      roads: this.roads,
      // Recomputed rather than taken from the traffic stage, which a loaded save never ran.
      components: componentStats(this, this.roads),
      epidemic: epidemic
        ? d.epidemicResidentialFactor + (1 - d.epidemicResidentialFactor) * healthCover
        : 1,
    });
    // New, upgraded or emptied buildings change utility demand.
    this.networksDirty = true;
    if (this.ruleset === 'oasis') {
      updateSpring(this);
      this.lastCorps = updateCaravans(this);
      this.lastStorm = updateStorms(this);
      this.lastGrid = updateGrid(this);
    }
    const report = computeMonthlyReport(this, {
      crisisRevenue: crisis ? d.crisisRevenueFactor : 1,
      epidemicCommercial: epidemic ? d.epidemicCommercialRevenue : 1,
    });
    applyMonthlyBudget(this, report);
    if (this.ruleset === 'oasis' && this.oasis.waterPolicy)
      this.oasis.waterPolicy.rationedTicks = 0;
    // After the budget, so a grant reads as its own line rather than as monthly revenue.
    if (this.ruleset === 'oasis') updateJourney(this);
    this.layerStats = computeLayerStats(this);
    this.recordHistory(cityTotals(this));
    const date = dateOf(this.tick);
    if (date.month === 0) this.emit({ type: 'newYear', year: date.year });
    monthlyDisasters(this);
  }

  private recordHistory(totals: CityTotals): void {
    const report = this.economy.lastMonth;
    const layer = this.layerStats as LayerStats;
    const revenue =
      report.revenue.residential + report.revenue.commercial + report.revenue.industrial;
    this.history.push({
      month: monthIndex(this.tick) - 1,
      population: totals.residents,
      funds: this.economy.funds,
      jobs: totals.commercialJobs + totals.industrialJobs,
      demandR: this.demand.residential,
      demandC: this.demand.commercial,
      demandI: this.demand.industrial,
      revenue,
      expenses: revenue - report.net,
      pollution: layer.averages.pollution,
      crime: layer.averages.crime,
      landValue: layer.averages.landValue,
    });
    if (this.history.length > BALANCE.history.maxMonths) this.history.shift();
    this.historyDirty = true;
    for (const m of MILESTONES) {
      if (m > this.lastMilestone && totals.residents >= m) {
        this.lastMilestone = m;
        this.emit({ type: 'milestone', population: m });
      }
    }
  }

  private apply(command: Command): CommandResult {
    if (!isToolCommand(command)) return applyPolicyCommand(this, command);
    const plan = planToolCommand(this.planContext(), command);
    if (plan.ok) {
      applyToolPlan(this, command, plan);
      this.refreshUtilities();
    }
    const result: CommandResult = {
      ok: plan.ok,
      cost: plan.ok ? plan.cost : 0,
      applied: plan.ok ? plan.valid.length : 0,
      skipped: plan.invalid.length,
    };
    if (plan.reason) result.reason = plan.reason;
    return result;
  }
}

function utilityStats(u: UtilityResult): CityStats['power'] {
  return { supply: u.supply, demand: u.demand, served: round4(u.served) };
}

/** Averages and coverage derived purely from the influence layers and buildings. */
function computeLayerStats(engine: SimulationEngine): LayerStats {
  const w = engine.world;
  const inf = w.influence;
  let n = 0;
  let pollution = 0;
  let crime = 0;
  let land = 0;
  const covered = { police: 0, fire: 0, health: 0, education: 0 };
  for (const b of engine.buildings.values()) {
    if (!isZoneKind(b.kind) || b.abandoned) continue;
    const i = w.index(b.x, b.y);
    n++;
    pollution += inf.pollution[i] as number;
    crime += inf.crime[i] as number;
    land += inf.landValue[i] as number;
    if ((inf.police[i] as number) >= 64) covered.police++;
    if ((inf.fireCover[i] as number) >= 64) covered.fire++;
    if ((inf.health[i] as number) >= 64) covered.health++;
    if ((inf.education[i] as number) >= 64) covered.education++;
  }
  let congestion = 0;
  let roads = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (!w.hasInfra(i, Infra.Road)) continue;
    roads++;
    congestion += Math.min(2, (inf.traffic[i] as number) / 128);
  }
  const avg = (v: number) => (n === 0 ? 0 : Math.round(v / n));
  const frac = (v: number) => (n === 0 ? 0 : round4(v / n));
  return {
    avgCongestion: roads === 0 ? 0 : round4(congestion / roads),
    averages: { pollution: avg(pollution), crime: avg(crime), landValue: avg(land) },
    coverage: {
      police: frac(covered.police),
      fire: frac(covered.fire),
      health: frac(covered.health),
      education: frac(covered.education),
    },
  };
}

function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
