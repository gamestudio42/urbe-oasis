# Urbe Oasis

A desert city builder in the browser. You lay out the canals, the wells and the shade.
The simulator decides who stays.

The classic city rules are still in this repository and do not change. Urbe Oasis runs
them with `ruleset: 'oasis'`: shade instead of bandwidth, cisterns and qanats on the
water network, caravans that pay the treasury, sandstorms, and a spring that moves.

```sh
pnpm install
pnpm dev
```

The game is at http://localhost:5180.

## What is different from the classic city

- A lot without shade or water stops at level 2.
- Canals carry shade on the surface. Palms are small shade trees. A spring house is
  only at full strength near the spring and on the water network.
- Qanats bring water without a river. Unshaded wells and pumps evaporate.
- Cisterns store spare water.
- Caravans buy watered or shaded lots and pay the city. They leave dry lots.
- Sandstorms bury a service. Windbreaks hold them back and a storm can push the spring.
- The art direction is adobe: low roofs, sand, terracotta and turquoise. The music is slow.

Player-facing text is in five languages (`en`, `pt-BR`, `es`, `fr`, `de`).

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

The formulas are in [docs/oasis-spec.md](docs/oasis-spec.md). Guidance for agents is in
[AGENTS.md](AGENTS.md).
