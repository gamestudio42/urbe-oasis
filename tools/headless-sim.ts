/**
 * Headless simulation runner used to calibrate the balance weights.
 *
 *   pnpm sim --preset balanced --months 120 --seeds 1,2,3,4,5
 *   pnpm sim --list
 *
 * Writes one JSON report per seed with a metrics row per month (population, jobs, RCI,
 * finances, occupancy, share of buildings with power and water, congestion, coverage,
 * milliseconds per month and heap usage) plus a summary across all seeds.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { collectMetrics, hashState, SIM_PRESETS, type MonthMetrics } from '@city/simulation';

interface MonthRow extends MonthMetrics {
  msPerMonth: number;
  heapMb: number;
}

interface SeedSummary {
  seed: string;
  finalPopulation: number;
  peakPopulation: number;
  finalFunds: number;
  minFunds: number;
  bankrupt: boolean;
  monthsInDebt: number;
  unemployment: number;
  occupancy: number;
  powered: number;
  watered: number;
  avgCongestion: number;
  shadeSupply?: number;
  shadeDemand?: number;
  shadeServed?: number;
  demand: MonthMetrics['demand'];
  coverage: MonthMetrics['coverage'];
  abandoned: number;
  avgMsPerMonth: number;
  maxMsPerMonth: number;
  peakHeapMb: number;
  hash: string;
  /** Oasis era calendar, for journey cities that reach it. */
  era?: EraLog;
}

interface EraLog {
  /** Month each title was earned. */
  rankMonths: number[];
  /** Each dry season: start month, mean water served and whether it held. */
  seasons: { start: number; served: number; held: boolean }[];
}

const { values } = parseArgs({
  options: {
    preset: { type: 'string', short: 'p', default: 'balanced' },
    months: { type: 'string', short: 'm', default: '120' },
    seeds: { type: 'string', short: 's', default: '1,2,3,4,5' },
    size: { type: 'string' },
    out: { type: 'string', short: 'o', default: 'reports/sim' },
    list: { type: 'boolean', default: false },
    quiet: { type: 'boolean', short: 'q', default: false },
  },
});

if (values.list) {
  for (const [name, preset] of Object.entries(SIM_PRESETS)) {
    console.log(
      `${name.padEnd(12)} ${String(preset.defaultSize).padStart(3)}  ${preset.description}`,
    );
  }
  process.exit(0);
}

const preset = SIM_PRESETS[values.preset];
if (!preset) {
  console.error(`Unknown preset "${values.preset}". Use --list to see the available presets.`);
  process.exit(1);
}
const months = Number(values.months);
const size = values.size ? Number(values.size) : preset.defaultSize;
const seeds = values.seeds
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!Number.isInteger(months) || months <= 0 || !Number.isInteger(size) || seeds.length === 0) {
  console.error('Invalid --months, --size or --seeds.');
  process.exit(1);
}

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;
const heapMb = () => round(process.memoryUsage().heapUsed / 1_048_576, 1);

function simulate(seed: string): { rows: MonthRow[]; summary: SeedSummary } {
  const { engine, onMonth } = preset!.create(seed, size);
  const rows: MonthRow[] = [];
  const era: EraLog = { rankMonths: [], seasons: [] };
  for (let m = 0; m < months; m++) {
    const start = performance.now();
    engine.runMonths(1);
    const msPerMonth = round(performance.now() - start);
    for (const event of engine.takeEvents()) {
      if (!engine.oasis.journey?.era) continue;
      if (event.type === 'eraRank') era.rankMonths.push(m + 1);
      if (event.type === 'droughtStarted')
        era.seasons.push({ start: m + 1, served: 0, held: false });
      const season = era.seasons.at(-1);
      if (event.type === 'droughtEnded' && season) {
        season.served = event.served;
        season.held = event.held;
      }
    }
    rows.push({ ...collectMetrics(engine), msPerMonth, heapMb: heapMb() });
    onMonth(engine);
  }
  const last = rows.at(-1) as MonthRow;
  const ms = rows.map((r) => r.msPerMonth);
  return {
    rows,
    summary: {
      seed,
      finalPopulation: last.population,
      peakPopulation: Math.max(...rows.map((r) => r.population)),
      finalFunds: last.funds,
      minFunds: Math.min(...rows.map((r) => r.funds)),
      bankrupt: last.bankrupt,
      monthsInDebt: last.monthsInDebt,
      unemployment: last.unemployment,
      occupancy: last.occupancy,
      powered: last.powered,
      watered: last.watered,
      avgCongestion: last.avgCongestion,
      ...(last.shadeServed === undefined
        ? {}
        : {
            shadeSupply: last.shadeSupply,
            shadeDemand: last.shadeDemand,
            shadeServed: last.shadeServed,
          }),
      demand: last.demand,
      coverage: last.coverage,
      abandoned: last.buildings.abandoned,
      avgMsPerMonth: round(ms.reduce((a, b) => a + b, 0) / ms.length),
      maxMsPerMonth: Math.max(...ms),
      peakHeapMb: Math.max(...rows.map((r) => r.heapMb)),
      hash: hashState(engine),
      ...(engine.oasis.journey?.era ? { era } : {}),
    },
  };
}

mkdirSync(values.out, { recursive: true });
const summaries: SeedSummary[] = [];
for (const seed of seeds) {
  const { rows, summary } = simulate(seed);
  summaries.push(summary);
  const file = join(values.out, `${values.preset}-${size}-seed-${seed}.json`);
  writeFileSync(
    file,
    JSON.stringify({ preset: values.preset, seed, size, months, summary, monthly: rows }, null, 2),
  );
  if (!values.quiet) console.log(`seed ${seed}: ${file}`);
}

const mean = (pick: (s: SeedSummary) => number) =>
  round(summaries.reduce((a, s) => a + pick(s), 0) / summaries.length);
const aggregate = {
  preset: values.preset,
  size,
  months,
  seeds,
  meanFinalPopulation: mean((s) => s.finalPopulation),
  minFinalPopulation: Math.min(...summaries.map((s) => s.finalPopulation)),
  maxFinalPopulation: Math.max(...summaries.map((s) => s.finalPopulation)),
  meanFinalFunds: mean((s) => s.finalFunds),
  bankruptcies: summaries.filter((s) => s.bankrupt).length,
  meanUnemployment: mean((s) => s.unemployment),
  meanPowered: mean((s) => s.powered),
  meanWatered: mean((s) => s.watered),
  meanCongestion: mean((s) => s.avgCongestion),
  meanMsPerMonth: mean((s) => s.avgMsPerMonth),
  peakHeapMb: Math.max(...summaries.map((s) => s.peakHeapMb)),
  perSeed: summaries,
};
writeFileSync(
  join(values.out, `${values.preset}-${size}-summary.json`),
  JSON.stringify(aggregate, null, 2),
);

console.table(
  summaries.map((s) => ({
    seed: s.seed,
    pop: s.finalPopulation,
    funds: s.finalFunds,
    unemp: s.unemployment,
    occ: s.occupancy,
    power: s.powered,
    water: s.watered,
    data: s.shadeServed,
    congestion: s.avgCongestion,
    R: s.demand.residential,
    C: s.demand.commercial,
    I: s.demand.industrial,
    abandoned: s.abandoned,
    'ms/month': s.avgMsPerMonth,
    bankrupt: s.bankrupt,
  })),
);

for (const s of summaries) {
  if (!s.era) continue;
  const seasons = s.era.seasons
    .map((d) => `${d.start}${d.held ? '' : '✗'} (${Math.round(d.served * 100)}%)`)
    .join(', ');
  console.log(
    `seed ${s.seed} era: titles at ${s.era.rankMonths.join(', ') || '-'}; dry seasons ${seasons}`,
  );
}
