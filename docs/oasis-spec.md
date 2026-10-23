# Urbe Oasis ruleset

Urbe Oasis is the city builder running `ruleset: 'oasis'`. The classic ruleset is unchanged.
Every new rule below is skipped when the ruleset is `classic`.

Constants live in `packages/shared/src/balance/oasis.ts`.

## Shade

Canals (`Infra.Canal`) and buildings conduct shade, the same way pipes conduct water.
A palm supplies `palmSupply` (80) with no power and no water. A spring house supplies
`springSupply` (400) when it is powered, watered and within `springRadius` (20 tiles,
Chebyshev) of the spring. If it has only the spring or only water, it supplies
`springSupplyDry` (120). Otherwise it supplies nothing.

A lot without water or without shade stops at level `maxLevelWithoutShade` (2). With both,
a dense lot can reach level 5 and a light lot level 2.

## Water

A qanat adds `qanatSupply` (260) water while it is powered. It does not add power.
An unshaded well or pump keeps `evaporation` (0.55) of its output. A qanat does not evaporate.
Shade is solved after water, so the shade flag used for evaporation is the one from the
previous pass.

A cistern charges while its water component has spare supply, and that stored water stays out of
the offer. When demand passes the base supply, the cistern releases only the missing water, up
to `charge * cisternOutput`, and the charge falls by the same share. A component whose demand
reaches `overloadThreshold` (0.9) of its supply is parched. If that component has a qanat, one
qanat goes offline for `cascadeOutageDays` and the collapse notice fires. With no qanat, a share
of the other buildings goes offline and only the water-stress notice fires.

## Spring

The spring starts at the map centre (the first open tile on a ring around it).
Every `springMoveMonths` (6) it steps up to `springStep` (5) tiles. A sandstorm that
lands nudges it 2 tiles. The roll comes from a generator seeded by the city seed and
the month, so it does not consume the caravan and storm stream.

The position is on `CityStats.oasis.spring` and drawn by the renderer.

## Caravans

Four houses buy vacant zoned lots that are watered or shaded, in their own quadrant.
The fee is paid into the city treasury (`funds += fee`). Each month a house may abandon
one owned lot that is neither watered nor shaded. Buy and abandon run only while a
caravanserai is powered and online. Without one, the month does not move cash.

## Sandstorms

Once a month a service with jobs may be buried. A windbreak in radius lowers the chance
while it is powered and online; shade is not required. A buried service goes offline.
Sand does not take money. A storm that lands nudges the spring.

## Arcades

An arcade eases traffic on the streets beside it while it is powered and online. The
road is required when it is placed. The adobe theme does not draw drones.

## Saves

Oasis cities use the envelope `oasis-city-save` and the extension `.oasis.json`.
A classic file stays classic when opened here.
