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

## Deterministic simulation performance checkpoint (2026-10-24)

The benchmark now includes a full `stateHash` and an `oasis-grid` workload: the same dense
128 by 128 road/pipe grid, with Oasis rules, shade canals along each horizontal street and
one palm beside each street. It uses the same automated plant/pump maintenance. This matters
because the original `grid` workload exercises classic rules, not cisterns, shade and water stress.
The new preset is a stress workload with a large treasury, not a recommended opening build.

Three separate Node processes were measured before and after the optimizations, with seed
`bench`, 96 warm-up months and 24 measured months. The benchmark harness and Oasis preset
were identical in both sets; the starting simulation implementation was commit `4619b73`.
Reports are in `reports/performance-before/` and `reports/performance-after/`.

```sh
for preset in grid oasis-grid; do
  for trial in 1 2 3; do
    node --import tsx tools/benchmark.ts --preset "$preset" --out "reports/performance-after/$preset-$trial.json"
  done
done
```

Median cost per simulated month fell from 33.766 to 30.596 ms for classic (9.4%) and from
58.145 to 49.892 ms for Oasis (14.2%). Median p95 utility-refresh cost fell from 10.885 to
9.109 ms for classic and from 28.499 to 24.969 ms for Oasis. Median p95 influence cost fell
from 9.698 to 8.382 ms for classic and from 12.196 to 8.900 ms for Oasis. These are local CPU
measurements, not a frame-rate claim or a guarantee on another device. Calibration medians
were 14.86 versus 14.24 ns per tile for classic, and 15.77 versus 15.80 for Oasis.

A separate paired check loaded the pre-change and optimized functions in the same process,
warmed both, and alternated which ran first for twelve batches. Utility batches made twenty
solves; blur batches made one hundred calls on the same 128 by 128 input. Median utility cost
fell 8.3% for classic and 11.1% for Oasis; radius-one and radius-two blur costs fell 40.5% and
36.2%. Both utility variants ended with identical state hashes. The local comparison scripts,
original functions and raw samples are retained in `reports/` (`performance-paired.json`).

All six full benchmark runs per workload ended with the same hash: classic `b6c91483`
(32673 residents, 4312 buildings) and Oasis `e51be040` (31735 residents, 4340 buildings).
The three 120-month `oasis-balanced` controls also retain every gameplay metric and hashes
`6dda1252` / `6a82429f` / `2967728c`. Continuous-rationing controls retain every gameplay metric
and hashes `f80e15de` / `86c194df` / `e4fac10f`.

**The 8 ms heavy-tick target still fails.** Median p95 traffic is 10.988 ms for classic and
12.101 ms for Oasis; Oasis monthly closing is 12.784 ms. Further work is needed, especially on
Oasis water-network traversal. The budgets were not relaxed, and no monthly stage was skipped
or moved to produce these gains.

Validation: `pnpm check` passes with 376 unit/integration tests, 17 simulation scenarios,
lint, type checking and the production build. All 14 Oasis Playwright tests pass against an
isolated production preview. The new replay fixtures preserve pre-optimization hashes, while
focused tests verify scratch isolation and exact blur results across window sizes and edges.

## Oasis water traversal checkpoint (2026-10-24)

Starting at `daabd74`, cistern settlement now skips component discovery when there is no
powered, online bank, and otherwise reuses the current refresh's water conductor mask.
Cascade evaluation and stress reporting share their component calculation until an outage
changes the network. The report then rebuilds immediately. There is no cross-refresh cache,
change to traversal/RNG order, or change to the classic rules.

Fresh three-process benchmark sets are in `reports/water-network-before/` and
`reports/water-network-after/`, using the same `grid` and `oasis-grid` workloads, seed `bench`,
96 warm-up months and 24 measured months. Every run retains classic hash `b6c91483` or Oasis
hash `e51be040`, including identical population, buildings and funds.

These unpaired timing sets are too noisy for an overall speedup claim: median simulated-month
cost was 10.672 versus 12.883 ms for unchanged classic, and 11.072 versus 15.568 ms for Oasis.
Calibration ranges also shifted (classic 4.69–6.12 versus 6.99–24.47 ns/tile). Two of the six
post-change runs miss a heavy-stage budget; all six baseline runs passed. This shared-machine
measurement does not establish a stable 8 ms budget or a whole-game frame-rate improvement.

A paired comparison loads the original and optimized utility/grid functions in one process,
with identical snapshots of the 96-month Oasis grid. Each variant warms up for 25 refreshes,
then runs twelve batches of twenty refreshes, alternating which variant runs first. Complete
state hashes and emitted events match after every pair of batches. Median combined utility,
cascade and stress-report cost fell from 4.895 to 4.278 ms without banks (12.6%), and from
4.751 to 4.552 ms with one powered cistern (4.2%). These are subsystem measurements in this
environment, not percentages to add to the earlier whole-month result. Scripts, original
functions and raw samples are retained in `reports/water-network-paired*` and
`reports/water-*-before.ts`.

The 120-month, three-seed `oasis-balanced` and `oasis-rationing` reports retain every gameplay
metric and hash from the previous checkpoint. Timing and heap fields are excluded from that
comparison. New regression tests cover stale delivery after loss of power, offline status
and demolition, reserve preservation/recovery, read-only summaries, and identical RNG/events
through both qanat and ordinary-building cascades. The sole-source qanat failure explicitly
checks that the post-outage stress report drops the now-unsupplied component.

Validation: `pnpm check` passes with 381 unit/integration tests, 17 simulation scenarios,
lint, type checking and the production build. All 14 Oasis Playwright tests pass against
an isolated production preview.

## Oasis journey checkpoint (2026-10-24)

The journey and its dry season apply only to cities founded with `journey: true`. The existing
presets have no journey, so the control must stay identical.

```sh
pnpm sim --preset oasis-balanced --months 120 --seeds 1,2,3 --out reports/journey-control
pnpm sim --preset oasis-journey --months 120 --seeds 1,2,3 --out reports/journey
pnpm bench --out reports/bench/oasis-journey.json
```

The control matches the previous reference exactly: populations 2538 / 2372 / 2587 and funds
5027 / 1670 / 5495. With $30,000 of extra starting capital, the `oasis-journey` automated player
completes all five chapters. The completion months are 26, 27, 28, 32, 33 for seed 1, then
25, 26, 27, 31, 32 for seed 2, and 5, 6, 7, 11, 12 for seed 3. Every seed holds on through the
drought, with mean water service of 0.840 / 0.828 / 0.850, and earns the full $16,500 in grants.
After 120 months, populations are 6271 / 5538 / 5263 and funds 88729 / 71923 / 78754, and none
is bankrupt. Water service ends at 1.0. Shade service ends at 0.15, because this player never
extends the canals. Most of the extra growth comes from the qanats bought with the extra
capital and from caravanserai trade, not from the grants. The chapter pace comes from that
scripted player and does not predict a human player's pace.

The first chapter is the slow one: seeds 1 and 2 need about two years to bring water and shade
to 80% of consumers. Shelter, and then reserves, follow within a month each, because the
automated player builds the answer as soon as a chapter opens.

The benchmark grid city is classic, so it never runs the journey. It ends at 32673 residents and
4312 buildings. p95 in milliseconds: traffic 7.702, services 1.283, influence 7.017, close 8.130,
utility refresh 6.638. **The heavy-tick budget still fails**, by 0.13 ms on the month close. That
is within this shared machine's run-to-run variation, and the earlier checkpoints also record it.

## Rendering, memory and long-session checkpoint (2026-10-24)

`pnpm bench:render` checks the production build in real browsers. It serves `apps/oasis/dist`
with a preview server and builds two Oasis cities with the same automated players as `pnpm sim`:
`journey-64` (seed 3, 48 months, 4715 residents, street life and caravans) and `balanced-128`
(seed 1, 60 months, 2305 residents). It measures `requestAnimationFrame` intervals in four views:
idle at zoom 1, panning, street level at zoom 2.4, and the zoomed-out overview at 0.5. It then
runs each city at full speed and samples heap, frame rate and renderer counts every 30 seconds.
The debug API's `renderStats()` reports chunks, visible chunks, display objects and generated
textures. A count that keeps rising in a steady city points to a leak.

```sh
pnpm build
pnpm bench:render --headed --view 8 --session 180     # GPU, a visible browser window
pnpm bench:render --browsers chromium --session 600   # headless, ten-minute session
```

**Headed Chromium 156 on this machine's GPU (Wayland desktop, 1440×900):** every view of both
cities holds 60 fps, with p50 16.7 ms and p95 16.8 ms. Frames over 33 ms make up 0.4% of the
`journey-64` views (2% of its overview) and at most 0.2% of the `balanced-128` views. During three
minutes at full speed (about 120 game months), the heap swings between 44 and 142 MB on
`journey-64` and between 60 and 105 MB on `balanced-128`, with no upward trend. Generated
textures stay at 154 and 134. Display objects follow the city's own growth (547 to 615 as
`journey-64` keeps building) or stay flat (742 to 737). One 30-second sample dropped to 30 fps
during a month close at full speed; the next returned to 60.

**Headless runs render through software (SwiftShader).** Frame times there vary several-fold
between identical runs (for example, an idle p50 of 16.8 ms in one run and 66.7 ms in the next),
because the simulation worker and the software rasteriser compete for the CPU. Use headless
results only for leak trends, not for fluidity. Turning animations off, or pausing during the
views, did not make the 64-tile city consistently faster, so the cost is not street life.

**Headed Firefox 157 (same machine):** the first run found a real bug. The Oasis score called
`AudioParam.cancelAndHoldAtTime`, which Firefox does not implement, so every track, pause and
mood change threw, and even a speed change failed. The ramp now holds the current value
portably. After the fix, every view of both cities holds about 59 fps (p50 17 ms, at most 2.4%
of frames over 33 ms). Display objects and textures follow the same pattern as in Chromium, with
no leak; Firefox does not report the JS heap. One three-minute session dropped to 0.8 fps after
the first minute while the simulation kept advancing. A repeat with the window in focus held
142.9 fps throughout on a high-refresh display, so that drop was Firefox throttling an
unfocused window, not a render stall.

**Not yet covered:** WebKit. Playwright's fallback WebKit build targets Ubuntu 24.04 and links
against ICU 74, `libxml2.so.2` and `libjxl.so.0.8`. This machine runs Ubuntu 25.10, which ships
ICU 76 and `libxml2.so.16` and has no packages for the older versions, so
`playwright install-deps` fails there. The official Playwright Docker image would run WebKit,
but only headless (software rendering, useful for leaks rather than frame rate). Other GPUs
and phones; sessions longer than ten minutes; and real players. The new E2E check
`oasis-render-health` keeps the leak guard in CI: after warm-up, textures may not grow by more
than 12 and display objects stay within bounds over 20 seconds at full speed.

## Oasis balance pass: early economy, shade at scale and cisterns (2026-10-25)

Three questions from the overall review, measured with `pnpm sim` (reports in `reports/balance/`).

```sh
pnpm sim --preset oasis-founding --months 60 --seeds 1,2,3 --out reports/balance/oasis-founding
pnpm sim --preset oasis-balanced --months 120 --seeds 1,2,3 --out reports/balance/oasis-balanced
pnpm sim --preset oasis-journey --months 120 --seeds 1,2,3 --out reports/balance/oasis-journey
pnpm sim --preset oasis-rationing --months 120 --seeds 1,2,3 --out reports/balance/oasis-rationing
pnpm bench --out reports/bench/oasis-balance.json
```

**Early economy.** The reference town (`oasis-balanced`) ran in debt for its first four or five
years. That came from the preset itself: it opens police, fire, health and education in month 1,
about $380 a month before anyone lives there, and at about $0.30 of tax per resident a month it
breaks even only near 2,000 residents. The classic `balanced` town follows the same curve with
the same shared constants, so no tax or upkeep was changed. The new `oasis-founding` preset
follows the founding tutorial on Normal funds: an edge road, a small quarter, four turbines,
three wells, a canal and a palm, and no services. Its automated player follows the guide,
adding a palm or a well only when supply is short and two cisterns after the first chapter.
On seeds 1–3 it reaches 100 residents in month 7. The treasury never drops below about $6,800
(it opens at $10,000 and spends about $2,500 on the start) and ends at $12,700–12,960 after five
years, with 2 palms and 4–5 wells. It completes chapter 1 in month 7 and the reserves chapter in
month 10. Recommendation for players and the guide: open services as the city passes roughly a
thousand residents, not on day one.

Building the founding preset exposed a connectivity rule that cost far more than money: an
empty zoned lot carried power but not water or shade. A pipe and canal led to an industrial
strip whose first column had no buildings yet, and in seed 2, eleven workshops stayed cut off
for two years, so chapter 1 waited until month 27 while the automated player bought palms that
could not reach them. **Empty Oasis lots now carry water and shade**, as they already carried power.
Built lots always conducted, so finished districts are unaffected; only the temporary gap goes.
In the scripted reference town this is neutral within seed variance (120 months, seeds 1–3:
populations 2496 / 2759 / 2357 with the change against 2967 / 2561 / 2741 without it; means
2537 and 2756, a difference smaller than the spread between seeds).

**Shade in grown cities.** The reference town's shade fell from 84% to 44% after five years and
stayed there. The cause was the spring, not the shade constants. It took a random step of up
to five tiles every six months with nothing to bring it back, and in seed 1 it drifted from
(32, 28) to (30, 63), 35 tiles in ten years. Both spring houses fell outside `springRadius` (20)
and dropped from 400 to 120 shade each. **The spring now stays within `springRange` (8) of the
map centre**: a step that would leave the range turns back, with the same random draw. Spring
houses within 12 tiles of the centre always keep it. The reference town's spring houses sit
about 15 tiles out, at the eastern edge, so they still lose it at times (shade 520–800); that is
the intended tension, and building nearer the centre avoids it. When the journey's automated
player also keeps shade like a player reading the coverage figure (up to three palms a month
beside the canals while supply is short), 12–15 palms hold shade at 95–100% for 6,471–8,016
residents after ten years, with monthly balances of +$908 to +$1,264. Shade scales with modest
investment once its sources stay valid.

**Cisterns.** A bank gained 1/240 of a charge per network refresh. A steady city refreshes about
once a month, so the journey city's three banks held 33% after five years (seed `probe`). The
legacy optional goal "cisterns half full" was close to unreachable, and repeated construction,
which refreshes on every command, could pump reserves. **Banks now gain `cisternChargePerDay`
(1/240) per whole day since their last settlement**, capped at 30 days a settlement, recorded on
the bank as `settledTick`. Several refreshes on one day add nothing. The same city's banks reach
75% six months after building and stay full under surplus, and they drain and refill in the
founding city when supply runs short. With charging that works, journey chapter 2 now asks for
two powered cisterns at least a quarter full (`reserveCharge` 0.25), reached two months after
building them.

**Results after the pass (120 months, seeds 1–3 unless noted):**

| Preset | Populations | Funds | Notes |
|---|---|---|---|
| `oasis-founding` (60 months) | 537 / 557 / 527 | 12958 / 12738 / 12805 | chapters 1–2 by month 7 and 10 |
| `oasis-balanced` | 2496 / 2759 / 2357 | 4152 / 9121 / 110 | was 2538 / 2372 / 2587 and 5027 / 1670 / 5495 |
| `oasis-journey` | 7330 / 8016 / 6471 | 105938 / 92513 / 88574 | all five chapters by month 11–13 |
| `oasis-rationing` | 2615 / 2742 / 2367 | 644 / 3410 / −2871 | seed 3 bankrupt (seed 2 before); continuous rationing remains a stress case |

Classic cities are unchanged: every change sits behind the Oasis ruleset, and the classic `grid`
reference hashes still match. The Oasis reference hashes in `tests/fixtures/performance-replay.json`
were regenerated for `oasis-grid` and `oasis-rationing`. The save/load replay inside that test
still passes, so determinism holds. The simulation benchmark (classic grid city) still reports
**`FAIL: heavyTicks`**, with traffic p95 8.17 ms and utility refresh p95 8.80 ms against 8 ms. None
of these rules run there, and earlier checkpoints recorded the same failure; it is variation on
this shared machine.

## Oasis era checkpoint (2026-10-26)

The era follows the journey, so only journey cities run it. The control must stay identical.

```sh
pnpm sim --preset oasis-balanced --months 120 --seeds 1,2,3 --out reports/era-control
pnpm sim --preset oasis-journey --months 120 --seeds 1,2,3 --out reports/era
```

The control matches the balance pass exactly: populations 2496 / 2759 / 2357 and funds
4152 / 9121 / 110. The journey preset completes the journey by month 12–13. Its era calendar:

| Seed | Town | City | Dry seasons (start month, grant)                     | Population | Funds  |
| ---- | ---- | ---- | ---------------------------------------------------- | ---------- | ------ |
| 1    | 16   | 34   | 31 ($3,000), 58 ($4,500), 85 ($6,000), 113 ($7,500)  | 7962       | 129901 |
| 2    | 16   | 32   | 32 ($3,000), 59 ($4,500), 86 ($6,000), 114 ($7,500)  | 7952       | 132174 |
| 3    | 17   | 37   | 32 ($3,000), 59 ($4,500), 86 ($6,000), 114 ($7,500)  | 6730       | 118350 |

Every seed holds all four dry seasons. No seed reaches Capital in ten years: seeds 1 and 2 end
just under 8,000 residents. By the fourth season (wells at 40%, qanats at 70%, four months) the
scripted player's supply is close to demand, with about 6% to spare, so later seasons, at the
35% floor and up to six months, will need more qanats or cisterns. Water and shade both end at
100% served. The scripted player builds as soon as a goal opens, so this pace does not predict a
human player's pace.

