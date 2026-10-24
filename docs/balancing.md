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
| `oasis-balanced` | The balanced town under the oasis ruleset, plus a canal spine and two spring houses |
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

### Earlier cyberpunk run

The table that used to sit here was `neon-balanced`: a 64×64 town run for 120 months on seeds 1–3
under the cyberpunk ruleset. Those numbers belong to that run. They have not been repeated for
Urbe Oasis, so this document does not treat them as the current result. Rerun `oasis-balanced`
before quoting a figure.

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


## Oasis founding presentation checkpoint (2026-10-23)

The founding defaults, landscape and tutorial change the first-play experience; they do not
change simulation rules or scripted presets. Reproduction commands (using Node's loader avoids
`tsx` CLI IPC restrictions in sandboxed environments):

```sh
node --import tsx tools/headless-sim.ts --preset oasis-balanced --months 120 --seeds 1,2,3 --out reports/founding
node --import tsx tools/benchmark.ts --out reports/bench/oasis-foundation.json
```

Compared with the pre-change run from the same session, every gameplay metric and final state
hash is identical. Seed 1 ends at population 2538, funds 5027, hash `6dda1252`; seed 2 at
population 2372, funds 1670, hash `6a82429f`; seed 3 at population 2587, funds 5495, hash
`2967728c`. None is bankrupt at the end. These results describe the scripted towns, not a
promise that every beginner city survives.

The normal-budget founding test separately builds a small road-connected settlement with
powered, watered and shaded homes, then charges a powered cistern. It retains positive funds
with the existing 10000 starting budget. Browser coverage also checks that an unpowered cistern
is counted in the HUD but remains empty, and that the tutorial waits for actual stored water.

The grid benchmark (128 by 128, 96 warm-up plus 24 measured months, Node 22.23.3) reports
32673 residents and 4312 buildings. Raw p95 timings in milliseconds: traffic 12.818, services
1.703, influence 12.073, close 10.885, utility refresh 15.613. The average fast tick is 0.0008
ms; a simulated month costs 39.901 ms. Calibration is 19.52 ns per tile. **The heavy-tick budget
still fails**; these environment-dependent measurements do not establish a rendering frame rate
or a performance improvement. Further performance work remains necessary.

Validation: `pnpm check` passes (361 unit/integration tests and 13 scenario tests), and all 11
Oasis Playwright tests pass. Unit-test concurrency is capped at two workers after the default
35-worker execution repeatedly exceeded an existing seeded-storm test's five-second timeout.
The assertions and timeout remain unchanged.

## Oasis water-management checkpoint (2026-10-24)

Rationing is an emergency choice, with demand multiplier 0.75 (rounded up per lot) and a
20% business-tax reduction for a full month, prorated by enabled ticks. Neither constant is
an empirical real-world estimate. The normal-supply control must remain unchanged.

```sh
node --import tsx tools/headless-sim.ts --preset oasis-balanced --months 120 --seeds 1,2,3 --out reports/rationing-control
node --import tsx tools/headless-sim.ts --preset oasis-rationing --months 120 --seeds 1,2,3 --out reports/rationing
node --import tsx tools/benchmark.ts --out reports/bench/oasis-rationing.json
```

All gameplay metrics and hashes in the control are identical to `reports/events/`: populations
2538 / 2372 / 2587, funds 5027 / 1670 / 5495, hashes `6dda1252` / `6a82429f` / `2967728c`.
The same automated player with continuous rationing ends at populations 2313 / 2264 / 2339
and funds 1062 / -702 / 1497. Seed 2 ends bankrupt; seeds 1 and 3 do not. Final water-service
shares are 0.9292 / 0.9259 / 0.9182. Different growth, tax income and affordable utility
expansions compound over time: reduced per-lot consumption does not guarantee better final
service coverage or a healthier treasury. This supports the policy's emergency role and is
not evidence that indefinite rationing is an optimal strategy.

A controlled near-capacity fixture separately demonstrates the immediate effect: an unshaded
well supplies 22 units to homes demanding 24; rationing reduces demand to 19, restores the
last home's water and removes network stress. A reserve fixture spends 32 units instead of
50. Half-month use retains its 10% business-tax reduction after switching off and after a
save/load; monthly closing clears the counter only after applying the budget.

The 128 by 128 grid benchmark again ends at 32673 residents and 4312 buildings. Raw p95 in
milliseconds: traffic 11.780, services 1.215, influence 11.011, close 9.053, utility refresh
14.163. The simulated month averages 35.658 ms and `stats()` 1.089 ms. **The heavy-tick budget
still fails.** These timings are from the shared development machine and are not an isolated
performance comparison or a renderer frame-rate measurement.

Validation: `pnpm check` passes with 374 unit/integration tests, 14 simulation scenarios and the
production build. The complete 14-test Oasis Playwright suite passes; the water-management
flow is also repeated against the final build after the save-counter validation and fractional
percentage display adjustments.
