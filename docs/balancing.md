# Balancing and performance

Weights and constants live in `packages/shared/src/balance/balance.ts`. This document records
how they were checked: headless runs over several seeds, and a benchmark against the tick
budgets. Rerun both after changing a rule and compare with the tables below.

## Headless simulation

```sh
pnpm sim --list                                          # available presets
pnpm sim --preset balanced --months 240 --seeds 1,2,3,4,5
pnpm sim -p grid --size 128 -m 120 -s 1,2,3 -o reports/sim --quiet
```

Each run writes `reports/sim/<preset>-<size>-seed-<seed>.json` with one row per month
(`collectMetrics()`: population, housing, jobs, employment, RCI demand, funds, revenue,
expenses, occupancy, share of buildings with power and with water, supply and demand of both
networks, congestion, service coverage, average pollution/crime/land value, building counts,
debt, active fires, plus `msPerMonth` and `heapMb`), and `<preset>-<size>-summary.json` with
per-seed results, the final state hash and the aggregate over seeds. `reports/` is
git-ignored.

Presets (`packages/simulation/src/scenarios/presets.ts`) drive the city with a scripted player:

| Preset       | City                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `balanced`   | Flat map, the scenario town with four services; adds plants and pumps |
| `disasters`  | Same town with fires and disasters on; clears rubble and rebuilds     |
| `neon-balanced` | The balanced town under the neon ruleset, plus a fiber spine and two datacenters |
| `no-power`   | Same town without any power plant                                     |
| `high-taxes` | Same town with every tax at 15%                                       |
| `grid`       | Flat 128×128 map filled with a street grid of dense zones (benchmark) |
| `terrain`    | Generated terrain and nothing built (baseline cost of an empty map)   |

## Results (64×64, 240 months, seeds 1–5)

Final month:

| Preset       | Population    | Funds             | Unemployment | Occupancy | Power     | Water    | Bankrupt at end |
| ------------ | ------------- | ----------------- | ------------ | --------- | --------- | -------- | --------------- |
| `balanced`   | 2 884 – 5 002 | 35 667 – 138 156  | 10 – 11%     | 82 – 83%  | 100%      | 92 – 98% | 0 of 5          |
| `disasters`  | 4 294 – 5 663 | 66 554 – 117 621  | 11 – 16%     | 78 – 85%  | 98 – 100% | 14 – 96% | 0 of 5          |
| `high-taxes` | 234 – 292     | −99 476 – −88 428 | 2 – 12%      | 83 – 88%  | 100%      | 50 – 67% | 5 of 5          |
| `no-power`   | 0             | −24 835           | –            | –         | 0%        | –        | 5 of 5          |

### Neo Urbe (`neon-balanced`, 64×64, 120 months, seeds 1–3)

The preset is the balanced town plus fiber along the water pipes and two datacenters: one against
the coal plant, one beside the pump column. Each hall supplies 400 when the water network reaches
it and draws 20 power, so the pair matches the old single hall's 800 bandwidth and 40 power. Upkeep
is 1 per hall. Eight per hall left seed 2 at −1,608 after 120 months, and four left it at −680.
One per hall is what closes every seed.

| Seed | Population | Funds | Unemployment | Occupancy | Power | Water | Data  | Congestion | Bankrupt |
| ---- | ---------- | ----- | ------------ | --------- | ----- | ----- | ----- | ---------- | -------- |
| 1    | 2 432      | 119   | 12.7%        | 82.2%     | 98.4% | 88.1% | 88.1% | 0.429      | no       |
| 2    | 2 489      | 16    | 14.6%        | 81.1%     | 94.3% | 81.5% | 81.5% | 0.431      | no       |
| 3    | 2 354      | 104   | 10.2%        | 72.4%     | 93.7% | 92.8% | 92.8% | 0.369      | no       |

Every seed is out of debt at month 120. The trough is still deep (−6,898, −7,625 and −7,604), and
seed 2 only crosses zero in the last month. Data served matches water served because the cable
follows the pipes; demand at the end is 577, 592 and 580 against a combined supply of 800. During
the run a hack drops one hall for half a month and the far side goes dark, which is why the lowest
monthly data share (seed 1) falls to about 0.43. Coal supply stays 800. End-of-run power demand is
808, 827 and 826, a little over the plant, and the served share stays above 0.93 because only the
last consumers are cut. The halls are 40 of that demand; the zones are what cross the 0.9 stress
line, so the halls were not shrunk to hide it. The month stays near 1.5 ms.

- **Balanced:** every seed grows for twenty years and ends with RCI demand near zero (the
  town is full). Seeds 1, 2 and 4 are in debt for 4 to 8 months between months 18 and 25 and
  recover on their own; seed 5 never goes into debt; seed 3 stays in debt from month 17 to 36
  and is bankrupt from month 28 to 36 before recovering.
- **Disasters:** every seed survives fires and disasters through the scripted recovery. The low
  water figure of seed 1 is its last month falling inside a fire wave that burned the pumps
  (months 234–240); the run ends before the scripted player rebuilds them.
- **High taxes:** demand collapses, the town stalls below 300 residents and every seed goes
  bankrupt around month 25.
- **No power:** nothing grows; the town only pays upkeep until bankruptcy.

### Early deficit

In the balanced town, revenue grows from about $110 a month (month 6) to $480 (month 18),
while expenses are a flat $600, $380 of which is the upkeep of the police station, fire
station, school and hospital built on day one. Raising every tax by 10% of its value would add
less than $50 a month at that stage, while `high-taxes` shows that 15% suppresses demand and
bankrupts every seed. The deficit is the price of founding all services at once, which the
scripted player does on purpose to exercise coverage; a player can delay them. Decision: keep
the economy weights. The debt warning and the recoverable bankruptcy are the intended pressure.

### Large city (grid, 128×128, 120 months, seeds 1–3)

Population 29 600 – 32 900, unemployment about 10%, occupancy 85%, power 100%, water about
91%, congestion about 0.1, no abandoned buildings. Funds are not meaningful here: the preset
starts with 10 million to place the whole grid.

## Benchmark

```sh
pnpm bench                                   # grid city, 128×128, 96 warm-up + 24 measured months
pnpm bench --preset terrain --out reports/bench/benchmark-terrain.json
pnpm bench --strict                          # exit 1 when a budget is exceeded
```

Every tick of the measured months is timed and classified: one of the four month stages
(`traffic`, `services`, `influence`, `close`), `utilityRefresh` (a day start that rebuilt the
power and water networks), or `fast` (everything else). Budgets: p95 of every heavy category
below 8 ms, and the average fast tick below 0.5 ms. The report also contains the cost of
`stats()`, the size and encoding time of a save, and the heap.

**Calibration.** Before reporting, the benchmark times a plain sum over a typed array of
`size²` elements (`calibrationNsPerTile`). That loop is a chain of floating-point additions, so
it runs at about 1 ns per element on a desktop CPU at full clock. `normalizedP95Ms` divides each
p95 by the calibration, an estimate of the same run on that reference machine. The pass/fail
gate always uses the raw timings.

Results on the development laptop (Intel i7-13620H, power-saving governor holding the CPU at
400–900 MHz; calibration 13.5 ns per tile, about 13× slower than the reference):

| Tick (grid, 32 700 residents, 4 312 buildings) | avg ms | p95 ms | p95 at 1 ns/tile |
| ---------------------------------------------- | ------ | ------ | ---------------- |
| traffic                                        | 7.9    | 9.5    | 0.71             |
| services                                       | 0.9    | 1.2    | 0.09             |
| influence                                      | 7.3    | 9.0    | 0.67             |
| close                                          | 5.5    | 7.5    | 0.56             |
| utility refresh                                | 7.9    | 9.9    | 0.74             |
| fast                                           | 0.001  | 0.001  | –                |

A simulated month costs 28 ms in total, `stats()` 0.8 ms, and a save is 1.4 MB, encoded in
175 ms. On this throttled CPU the grid city exceeds the raw 8 ms budget by 1–2 ms in four
categories. The terrain preset (generated map, nothing built) passes every budget at the same
clock (heaviest p95: influence, 6.2 ms). The fast tick is three orders of magnitude below its
budget.

What brought the month from about 40 ms with a single 20 ms tick down to these numbers:

- the month is staggered over four ticks (`docs/simulation-spec.md`, §8.1);
- networks are rebuilt only when dirty, with typed-array flood fills;
- road searches use a typed-array binary heap, a congestion penalty shared by the three trip
  trees, and skip pushes beyond the search radius;
- box blurs keep running sums in typed arrays, and the distance to water is cached until the
  terrain changes.

The data-structure changes keep the visiting and summation order, so they leave every state
hash unchanged. The staggering does change results slightly, because traffic and influence now
read the city a few ticks before the close; the scenario tests and the tables above were
produced with it.

**Rendering.** The 60 FPS target is not measured automatically: headless browsers render
WebGL in software. Check it by hand on a 128×128 city at 1× zoom with
`window.__cityDebug.fps()` in the browser console. Only chunks with dirty tiles are redrawn
and off-screen chunks are culled.

With the animations, the grid preset (128×128, 96 months, ~31 000 inhabitants) loaded in a
GPU-backed Chromium ran at 59–60 FPS (p95 frame 16.8 ms) both with the animations on and off:
127 cars at 1× zoom and 187 cars at the smallest zoom that still shows them. A CPU profile put
`AnimationLayer.update` at about 0.3 ms per frame, mostly sprite placement; Pixi's own render
dominates. Headless Playwright renders WebGL in software (about 3 FPS either way), so it cannot
measure this.
