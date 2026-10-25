# AGENTS.md

Guidance for AI agents and humans working on this repository.

## Mission

Build Urbe Oasis, a desert isometric city builder that runs in the browser.
The player creates conditions; the simulator decides the outcome. The oasis ruleset
adds shade canals, cisterns, qanats, sandstorms, caravans and a wandering spring
on top of the city engine. The menu founds oasis cities only.

## Golden rules

1. The simulation (`packages/simulation`) is pure TypeScript: no DOM, no Node APIs, no
   wall-clock time, no `Math.random`, no transcendental `Math` functions. Lint and type check
   enforce this. The same bans apply to the oasis systems in `packages/simulation/src/systems/oasis/`.
2. React components never contain economic or growth rules. They send commands and read state.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. City constants belong in `packages/shared/src/balance/balance.ts`, oasis constants in
   `packages/shared/src/balance/oasis.ts`, formulas in `docs/simulation-spec.md` and
   `docs/oasis-spec.md`, and their provenance in `docs/mechanics-matrix.md`.
6. Do not copy code, sprites, sounds or names from SimCity, Micropolis (GPLv3) or OpenSC2K.
   Study them in `references/` (git-ignored) and write independent code.
7. Code, comments, technical docs, commit messages and pull requests (title and
   body) are in English. Player-facing text lives in `apps/web/src/i18n/`
   (`en`, `pt-BR`, `es`, `fr`, `de`). Urbe Oasis overrides live in `apps/oasis/src/i18n.ts`.
   English is the type source. The first visit follows the browser language (or English).
8. The game never contains colours. The renderer reads a `Theme` from `@theme/core`;
   Urbe Oasis injects `@theme/oasis`. A theme also picks an architecture style (`theme.style`):
   `adobe` draws the low desert lots in `oasisZoneSprites.ts`. `cyber` remains for the
   sprite tests.
9. The classic ruleset must not change. New city mechanics go behind
   `ruleset === 'oasis'` and are covered by `tests/unit/oasis-*.test.ts`.

## Commands

```sh
pnpm install          # install dependencies
pnpm dev              # Urbe Oasis on http://localhost:5180
pnpm lint             # ESLint
pnpm typecheck        # tsc for every package
pnpm test             # unit + integration tests (Vitest)
pnpm test:simulation  # long scenario tests (Vitest)
pnpm test:e2e         # Playwright (builds and serves Urbe Oasis)
pnpm build            # production build of apps/oasis
pnpm sim --preset balanced --months 120 --seeds 1,2,3   # headless JSON reports
pnpm sim --list       # simulation presets
pnpm bench            # tick timing benchmark (128×128 grid city); --strict fails on budgets
pnpm check            # lint + typecheck + test + test:simulation + build
```

Reports go to `reports/` (git-ignored). `docs/balancing.md` holds the reference results; after
changing a city rule or constant, rerun the presets and the benchmark and update it.

Docker: `docker compose up` serves the dev build on port 5180.

## Work loop

1. Read the phase in `docs/roadmap.md` and the relevant section of `docs/simulation-spec.md`
   or `docs/oasis-spec.md`.
2. Inspect the existing code before adding new modules.
3. Make a small, testable change.
4. Run `pnpm check`; for UI changes also run `pnpm test:e2e`.
5. Run a headless report (`pnpm sim`) when the change touches the city simulation and compare the
   key metrics with the previous run.
6. Fix regressions before moving on.
7. Commit with a descriptive English message (conventional commits: `feat:`, `fix:`, `test:`...).
   Open pull requests in English (title and body).
8. Update docs when a rule or constant changes.

Never declare a feature done just because it compiles.

## Layout

```
packages/kernel/   RNG, hash, base64, save envelope, command queue
packages/bridge/   worker clock + RPC inbox
packages/view-iso/ isometric camera, picking, chunk grid
packages/chrome/   Store, boot/pause/toasts, i18n helpers, audio graph, IndexedDB
packages/simulation/src/systems/oasis/
                   Oasis ruleset: water grid, caravans, sandstorms, arcades, spring,
                   journey, rationing and building heights
packages/theme/    Colourless Theme interface
packages/theme-urbe/  Classic palette
packages/theme-oasis/ Desert palette, CSS tokens and audio parameters
packages/theme-neon/  Cyberpunk palette kept so the sprite tests still have a cyber skin
packages/view-city/  Renderer, sprites and animation layer (theme injected)
  civicSprites.ts    Traditional police, fire, school and hospital silhouettes
  cyberSprites.ts     Cyberpunk civic, utility, marina and power-pole silhouettes
  cyberZoneSprites.ts Cyberpunk houses, shops and factories
  utilitySprites.ts   Power plants, wind turbines, pumps and wells
apps/oasis/        Urbe Oasis web app (port 5180): theme, ruleset, copy and music
apps/web/src/      City UI the oasis app boots
  ui/         React screens and panels: boot screen, logo, menu, HUD, pause overlay,
              toolbar, minimap, budget, charts, overlays, inspector, tutorial, toasts
  state/      GameSession (UI store, panels, tutorial), CityClient (worker bridge +
              mirror world), debug hooks used by Playwright
  worker/     Web Worker host for the engine
  audio/      Synthesized WebAudio sound effects and the shared bus
  i18n/       Player catalogs (en type source, pt-BR, es, fr, de)
packages/simulation/src/
  world/ terrain/ commands/ systems/ persistence/ scenarios/ rng/
  scenarios/presets.ts  scripted cities for `pnpm sim` and `pnpm bench`
  engine.ts      orchestration and the tick pipeline (month staged over four ticks)
  time.ts        calendar and monthStage()
  diagnostics.ts diagnoseTile(), shared by the engine and the UI inspector
  report.ts      collectMetrics() for scenario and headless reports
packages/shared/src/
  types/ commands/ balance/ schemas/ protocol/ util/
tests/{unit,scenarios,e2e,helpers}
tools/{headless-sim.ts,benchmark.ts}
```

UI conventions: every interactive element that tests touch has a `data-testid`.
The UI only reads the mirror world and `CityStats`; anything that needs a rule (diagnostics,
previews) calls a pure function exported by `@city/simulation`.

## Definition of done

- Behaviour covered by tests at the right layer (unit for rules, scenario for emergent effects).
- `pnpm check` green, E2E green for UI changes.
- No new dependency without a written reason in the commit message.
- Docs updated.
