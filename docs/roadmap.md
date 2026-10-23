# Roadmap

Each phase must leave the game runnable and the full check (`pnpm check` plus `pnpm test:e2e`)
green. A phase is done only when its acceptance criteria pass.

| Phase                | Scope                                                                                | Acceptance criteria                                                        |
| -------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 0 — Foundation       | Monorepo, tooling, Docker, CI, reverse-engineering notes, docs                       | `pnpm lint typecheck test build` green                                     |
| 1 — Map              | Seeded RNG, terrain generation, `World`, chunked isometric renderer, camera, picking | Same seed → same terrain hash; E2E click selects the expected tile         |
| 2 — Construction     | Commands, roads, zones, demolish, level, costs, validation, road auto-tiling         | Commands change real state and charge funds; every rejection tested        |
| 3 — Economy          | Clock, buildings, RCI demand, attractiveness, growth and decline, taxes              | Balanced city grows; city without roads stagnates; replay is deterministic |
| 4 — Infrastructure   | Power, water, road graph, accessibility, aggregated traffic                          | Cutting a line unpowers a district and reconnecting restores it            |
| 5 — Services         | Police, fire, schools, hospitals, parks, influence maps, budget, bankruptcy          | Scenarios: industry near homes, high taxes, insufficient budget            |
| 6 — Interface        | Toolbar, HUD, minimap, overlays, budget, charts, building panel, tutorial            | Player manages the city without the console                                |
| 7 — Events and saves | Fire, flood, earthquake, crisis, blackout, epidemic; versioned saves                 | Fire scenario; save/load restores the same state hash                      |
| 8 — Polish           | Headless reports, benchmark, balancing, sprites, audio, static deploy                | End-to-end session stable; regression suite green                          |

## After 1.0 (evolution)

- Public transport (bus, rail, subway) as additional networks in the traffic assignment.
- Two-tile and larger grown buildings (merging dense lots).
- Map rotation, terrain editor, larger maps (256²) with chunked simulation scans.
- Agent layer: a few special agents (companies, mayor's advisors) with goals and preferences,
  simulated by traditional behaviour rules on top of the aggregated model.
- Generative AI layer for narrative events and advisors, never on the per-citizen hot path.
