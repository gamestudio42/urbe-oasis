/**
 * Simulation benchmark on a fully built 128×128 city.
 *
 *   pnpm bench                 # report only
 *   pnpm bench --strict        # exit 1 when a budget is exceeded (CI)
 *
 * Budgets: each heavy tick (the traffic, services and influence stages, the month close and the
 * utility refresh) below 8 ms at p95, and the ordinary tick below 0.5 ms on average.
 * `calibrationNsPerTile` makes runs on throttled CPUs (power-saving profiles) comparable.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { encodeSave, TICKS_PER_MONTH } from '@city/shared';
import { hashState, monthStage, SIM_PRESETS, type MonthStage } from '@city/simulation';

const BUDGETS = { heavyTickMs: 8, fastTickMs: 0.5 };
const HEAVY = ['traffic', 'services', 'influence', 'close', 'utilityRefresh'] as const;

const { values } = parseArgs({
  options: {
    preset: { type: 'string', default: 'grid' },
    size: { type: 'string', default: '128' },
    seed: { type: 'string', default: 'bench' },
    warmup: { type: 'string', default: '96' },
    months: { type: 'string', default: '24' },
    out: { type: 'string', default: 'reports/bench/benchmark.json' },
    strict: { type: 'boolean', default: false },
  },
});

const preset = SIM_PRESETS[values.preset];
if (!preset) {
  console.error(`Unknown preset "${values.preset}".`);
  process.exit(1);
}
const size = Number(values.size);
const warmup = Number(values.warmup);
const months = Number(values.months);

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;
function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const total = samples.reduce((a, b) => a + b, 0);
  return {
    count: samples.length,
    avg: round(samples.length ? total / samples.length : 0, 4),
    p50: round(at(0.5), 4),
    p95: round(at(0.95), 4),
    max: round(sorted.at(-1) ?? 0, 4),
  };
}

const setupStart = performance.now();
const { engine, onMonth } = preset.create(values.seed, size);
const setupMs = performance.now() - setupStart;

const warmStart = performance.now();
for (let m = 0; m < warmup; m++) {
  engine.runMonths(1);
  onMonth(engine);
}
const warmupMs = performance.now() - warmStart;

type Category = MonthStage | 'utilityRefresh' | 'fast';
const samples: Record<Category, number[]> = {
  traffic: [],
  services: [],
  influence: [],
  close: [],
  utilityRefresh: [],
  fast: [],
};
const all: number[] = [];
for (let m = 0; m < months; m++) {
  for (let t = 0; t < TICKS_PER_MONTH; t++) {
    const dirty = engine.networksDirty;
    const start = performance.now();
    engine.step();
    const ms = performance.now() - start;
    all.push(ms);
    const stage = monthStage(engine.tick);
    const category: Category =
      stage ?? (dirty && !engine.networksDirty ? 'utilityRefresh' : 'fast');
    samples[category].push(ms);
  }
  onMonth(engine);
}

// Reference workload so results can be compared across machines and power profiles.
const reference = new Float32Array(size * size).map((_, i) => i % 13);
let sink = 0;
const calStart = performance.now();
for (let r = 0; r < 200; r++)
  for (let i = 0; i < reference.length; i++) sink += reference[i] as number;
const calibrationNsPerTile = ((performance.now() - calStart) * 1e6) / (200 * reference.length);
if (sink < 0) console.log(sink);

const statsStart = performance.now();
for (let i = 0; i < 50; i++) engine.stats();
const statsMs = (performance.now() - statsStart) / 50;
const saveStart = performance.now();
const stats = engine.stats();
const save = JSON.stringify(
  encodeSave(engine.serialize(), {
    population: stats.population,
    funds: stats.funds,
    savedAt: '2000-01-01T00:00:00.000Z',
  }),
);
const saveMs = performance.now() - saveStart;

const result = {
  preset: values.preset,
  size,
  seed: values.seed,
  warmupMonths: warmup,
  measuredMonths: months,
  node: process.version,
  stateHash: hashState(engine),
  city: {
    population: stats.population,
    buildings: engine.buildings.size,
    roads: stats.counts.roads,
    funds: stats.funds,
  },
  /** Nanoseconds per element of a plain typed-array sum (~1 on a desktop at full clock). */
  calibrationNsPerTile: round(calibrationNsPerTile, 2),
  setupMs: round(setupMs),
  warmupMs: round(warmupMs),
  ticks: {
    ...(Object.fromEntries(
      Object.entries(samples).map(([name, list]) => [name, summarize(list)]),
    ) as Record<Category, ReturnType<typeof summarize>>),
    all: summarize(all),
  },
  /** p95 of each heavy tick scaled to the reference machine (1 ns per tile); an estimate. */
  normalizedP95Ms: Object.fromEntries(
    HEAVY.map((c) => [c, round(summarize(samples[c]).p95 / calibrationNsPerTile)]),
  ),
  msPerSimulatedMonth: round(all.reduce((a, b) => a + b, 0) / months),
  statsMs: round(statsMs),
  save: { bytes: save.length, encodeMs: round(saveMs) },
  heapMb: round(process.memoryUsage().heapUsed / 1_048_576, 1),
  budgets: BUDGETS,
  pass: {
    heavyTicks: HEAVY.every((c) => summarize(samples[c]).p95 < BUDGETS.heavyTickMs),
    fastTick: summarize(samples.fast).avg < BUDGETS.fastTickMs,
  },
};

mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out, JSON.stringify(result, null, 2));

const line = (name: string, s: ReturnType<typeof summarize>, budget: string) =>
  `${name.padEnd(16)} avg ${s.avg.toFixed(3).padStart(8)}  p95 ${s.p95.toFixed(3).padStart(8)}  max ${s.max
    .toFixed(3)
    .padStart(8)} ms  (${s.count} ticks, ${budget})`;
console.log(
  `${values.preset} ${size}×${size}: ${result.city.population} residents, ${result.city.buildings} buildings, ${result.city.roads} road tiles`,
);
for (const category of HEAVY) {
  console.log(line(category, result.ticks[category], `p95 < ${BUDGETS.heavyTickMs} ms`));
}
console.log(line('fast', result.ticks.fast, `avg < ${BUDGETS.fastTickMs} ms`));
console.log(
  `per month ${result.msPerSimulatedMonth} ms, stats() ${result.statsMs} ms, save ${result.save.bytes} bytes in ${result.save.encodeMs} ms, heap ${result.heapMb} MB`,
);
console.log(
  `calibration ${result.calibrationNsPerTile} ns per tile (about 1 at full clock); p95 scaled to 1 ns: ${HEAVY.map(
    (c) => `${c} ${result.normalizedP95Ms[c]}`,
  ).join(', ')} ms`,
);
const failed = Object.entries(result.pass).filter(([, ok]) => !ok);
console.log(failed.length ? `FAIL: ${failed.map(([k]) => k).join(', ')}` : 'PASS');
console.log(`report: ${values.out}`);
if (values.strict && failed.length) process.exit(1);
