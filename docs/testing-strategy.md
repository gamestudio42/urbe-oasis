# Testing strategy

## Layers

| Layer       | Location                | Runner     | Command                | Purpose                                                                |
| ----------- | ----------------------- | ---------- | ---------------------- | ---------------------------------------------------------------------- |
| Unit        | `tests/unit`            | Vitest     | `pnpm test`            | Pure functions: RNG, noise, geometry, validation, networks, save codec |
| Integration | `tests/integration`     | Vitest     | `pnpm test`            | Engine with several systems: commands + ticks + serialization          |
| Scenarios   | `tests/scenarios`       | Vitest     | `pnpm test:simulation` | Whole cities simulated for months or years, asserting trends           |
| End-to-end  | `tests/e2e`             | Playwright | `pnpm test:e2e`        | Real browser: boot, menu, picking, tools, HUD, save/load, music        |
| Reports     | `tools/headless-sim.ts` | tsx        | `pnpm sim`             | JSON reports for balancing                                             |
| Benchmarks  | `tools/benchmark.ts`    | tsx        | `pnpm bench`           | Tick timings and memory against budgets                                |

## Scenario rules

- Scenarios build cities with the helpers in `packages/simulation/src/scenarios`, on a flat map,
  so terrain randomness never breaks the layout.
- Assert **invariants and trends**, never exact growth numbers: "population with power is at
  least 5× population without power", not "population is 1234".
- Always use fixed seeds. When a scenario compares two variants, both use the same seed.
- Each scenario records its monthly metrics and named checks through `tests/scenarios/harness.ts`
  and writes `reports/scenarios/<name>.json` (git-ignored) before asserting, so a failing run
  still leaves a report to inspect.
- Scenarios that grow for years use `maintainTown`, a minimal automated player that adds
  plants and pumps when demand passes 85% of supply.
- `flatCity` disables random fires and disasters so trends are not luck. The repeated-simulation
  and save/load scenarios turn them on to exercise those RNG paths.
- A/B comparisons fork one city through `serialize()` / `fromSnapshot()` and change a single
  factor (the fire scenario cuts fire funding in the control), so both runs share every
  building.

## Required scenarios

| Scenario                 | Expected result                                             |
| ------------------------ | ----------------------------------------------------------- |
| City without power       | Growth limited by the missing service                       |
| Balanced city            | Sustained population growth, no bankruptcy                  |
| Very high taxes          | Lower demand and population than with neutral taxes         |
| Industry next to homes   | Lower residential land value and attractiveness             |
| Disconnected roads       | Lower job access and population                             |
| Insufficient budget      | Worse service coverage, debt, eventual bankruptcy           |
| Fire near a fire station | Less burnt area than the same fire without coverage         |
| Save/load                | Restored state has the same hash; both continue identically |
| Repeated simulation      | Same seed + same commands → same final hash                 |

## Determinism oracle

`hashState(engine)` hashes every layer, building, economy field and the RNG state. Tests compare
hashes, which makes any divergence visible immediately.

## End-to-end hooks

The web app exposes `window.__cityDebug` (always on, read-only helpers plus `runTicks` for tests):
the selected tile, tile lookup, statistics, camera helpers to project a tile to screen
coordinates, the engine hash, save export/import, disaster triggers, the boot step and the
music state. Playwright uses it to
click specific tiles and to assert results without parsing pixels. Screenshots are kept as
artifacts for visual review. Save tests cover IndexedDB across a reload, file export and
import, corrupted files (checksum, truncation, foreign JSON) and a simulated
`QuotaExceededError`.

`tests/e2e/full-run.spec.ts` plays a whole session the way a player would: it starts a 64×64
city from the menu (name, size, flat terrain, easy), builds a street, residential, commercial
and industrial zones and a coal plant with the toolbar, lets eighteen months pass, saves from
the system panel, reloads the page, loads the slot from the menu and checks that the hash,
population, funds and tiles are identical and that the loaded city runs again. It leaves
`test-results/full-run.png`. The same file checks that muting the sound survives a reload and
that `M` toggles it.

`tests/e2e/animation.spec.ts` builds a small town with a coal plant and a fire station through
debug commands and checks the cosmetic layer with `animationStats()` and `vehicleSample()`:
cars and smoke appear once the town has traffic, vehicles keep their positions while paused, a
fire brings a fire engine, water tiles glint, and the system-panel toggle removes everything
and is remembered. It leaves `test-results/animation.png` and `animation-fire.png`. The pure
rules behind it (lanes, density, routing, vents, dispatch) are unit tested in
`tests/unit/animation.test.ts`.

`tests/e2e/brand.spec.ts` covers the presentation layer: the page title and SVG favicon, the
boot screen shown before the menu (the menu is never mounted while booting), the live city
behind the menu (population, cars, ticks advancing, the camera drifting, no toasts from it),
and the music through `musicState()`: the menu track after the first click, the speaker
button muting it, the city track after founding a city, ducking and the pause overlay while
paused (a tile click still selects through it), and the music toggle surviving a reload. It
leaves `test-results/brand-boot.png`, `brand-menu.png` and `brand-pause.png`. The composer
rules (chord and scale membership, bass on beats 1 and 3, melody density, determinism per
seed) are unit tested in `tests/unit/music.test.ts`.

## Balancing reports and benchmarks

`pnpm sim` runs a preset city headless for many months and seeds and writes monthly JSON
reports; `pnpm bench` times every tick of a 128×128 city by category. Usage, presets, the
current results and the balancing decisions are in [balancing.md](balancing.md). CI runs both
in short form and uploads `reports/` as an artifact; the benchmark is informational there
(shared runners are noisy), and `pnpm bench --strict` turns the budgets into a failing exit
code.

## Performance budgets

- Heavy ticks on a 128×128 city (each month stage, and a network rebuild): p95 < 8 ms
  (Node, desktop CPU at full clock).
- Fast tick: < 0.5 ms average.
- Rendering: 60 FPS on a common laptop at 1× zoom (checked by hand with
  `window.__cityDebug.fps()`).

On a throttled CPU the raw timings say little about these budgets; the benchmark reports a
calibration and normalised p95 values for that case (see [balancing.md](balancing.md)).
