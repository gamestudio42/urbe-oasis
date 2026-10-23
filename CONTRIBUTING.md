# Contributing to Neo Urbe

Thanks for wanting to remix the city. Code, comments and docs are in English.
Player-facing text lives in `apps/web/src/i18n/` (`en`, `pt-BR`, `es`, `fr`, `de`).
Neo Urbe overrides live in `apps/neon/src/i18n.ts`. English is the type source.

## Quick start

```sh
pnpm install
pnpm dev        # http://localhost:5178
pnpm check      # lint, types, unit/integration/scenario tests, production build
pnpm test:e2e   # Playwright
```

Docker: `docker compose up`.

## Rules that keep the sim honest

1. `packages/simulation` is pure TypeScript: no DOM, no Node APIs, no wall-clock
   time, no `Math.random`, no transcendental `Math`. Lint enforces this.
2. React components send commands and read state. They do not contain growth or
   economy rules.
3. The renderer never mutates simulation state.
4. Every random decision uses the engine RNG, in a deterministic order.
5. Constants live in `packages/shared/src/balance/balance.ts` and
   `packages/shared/src/balance/neon.ts`. Formulas live in
   `docs/simulation-spec.md` and `docs/neon-spec.md`. Provenance lives in
   `docs/mechanics-matrix.md`.
6. Do not copy code, sprites, sounds or names from SimCity, Micropolis (GPLv3)
   or OpenSC2K. Study them in `references/` (git-ignored) and write original work.
7. Interactive elements that tests touch need a `data-testid`.
8. The classic ruleset must not change. New city mechanics go behind
   `ruleset === 'neon'`.

A fuller map of the repo is in [AGENTS.md](AGENTS.md).

## Pull requests

- One concern per pull request, with a test when the change is a rule.
- Title and body in English. Conventional commits (`feat:`, `fix:`, `test:`…).
- `pnpm check` green. UI changes also need `pnpm test:e2e`.
