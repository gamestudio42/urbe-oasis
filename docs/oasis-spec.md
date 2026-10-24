# Urbe Oasis ruleset

Urbe Oasis is the city builder running `ruleset: 'oasis'`. The classic ruleset is unchanged.
Every new rule below is skipped when the ruleset is `classic`.

Constants live in `packages/shared/src/balance/oasis.ts`.

## Founding and first settlement

The Oasis menu always founds an Oasis city, even after importing a classic save. Its terrain
defaults are `OASIS_TERRAIN`: water 0.04, hills 0.15, forest 0.04 and no rivers. Players can
still adjust each control. These defaults do not rewrite existing saves or scenario presets.
The adobe renderer uses dry ground, wild date palms and a spring landmark. Wild palms and
the landmark are cosmetic: they do not supply shade or water to a network.

The first founding starts paused, centred on the spring. A ten-step tutorial guides the player
through an edge-connected road, homes, jobs, power, water, shade, the first residents and a
charged cistern. Tool shortcuts select the real construction tools. Completion reads engine
telemetry and mirror-world service flags; it does not grant resources or change growth rules.
The shade step requires a residential tile with both water and shade. The cistern step requires
stored water, rather than merely placing the building. Completion is stored independently from
the classic tutorial under `oasis.tutorial.founding.v1`, with copy in all five supported locales.

The survival panel shows served shares and supply/demand from engine statistics, plus cistern
charge and the number of placed cisterns. Empty cities display “No consumers”; unpowered
cisterns still count as placed buildings. Water and shade buttons toggle their overlays, the
reserve button selects the cistern tool, and the spring button recentres the surface view.

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

A powered, online cistern charges while its water component has spare supply, and that stored
water stays out of the offer. When demand passes the base supply, the cistern releases only the missing water, up
to `charge * cisternOutput`, and the charge falls by the same share. A component whose demand
reaches `overloadThreshold` (0.9) of its supply is parched. If that component has a qanat, one
qanat goes offline for `cascadeOutageDays` and the collapse notice fires. With no qanat, a share
of the other buildings goes offline and only the water-stress notice fires.

Each utility refresh clears the previous cistern delivery before checking for powered, online
banks. Without an operating bank, settlement can skip its component traversal: no reserve can
charge or discharge. When banks exist, settlement reuses the water conductor mask already built
for this refresh; it retains the same source and BFS order, including inactive cisterns as
traversal origins. No mask or component result is retained across refreshes.

After utilities, cascade evaluation and the stress report share one component calculation.
If a cascade takes any building offline, the report rebuilds the components and their supply
from the new state. Otherwise the pre-cascade calculation is still current. Source order,
random draws, outages, event order and stress anchors are unchanged. A separate monthly stress
update still computes the live network independently.

### Emergency water rationing

`setWaterRationing` is an Oasis-only, reversible policy. Normal supply is the default.
With rationing selected, each occupied or vacant non-abandoned zone building asks for
`ceil(baseWaterDemand * OASIS_RATIONING.demandMultiplier)` (0.75). Placeables still ask for
zero. Integer rounding means the saving is **up to** 25%; small lots may save less.
Disconnected buildings remain disconnected. The water solve, cistern settlement and stress
calculation all use the same reduced demand. Power and shade demand are unchanged.

The command marks networks dirty; the next daily update applies the choice while the clock
runs. It does not run a solve, charge a cistern or consume RNG on its own. Repeated toggles
therefore cannot fill reserves. A paused city keeps its current network solution until time
advances (or another construction command causes the usual refresh).

Each simulated tick with the policy enabled increments `waterPolicy.rationedTicks`. At the
monthly close, commercial and industrial tax receipts use the multiplier
`1 - 0.20 * rationedTicks / TICKS_PER_MONTH`, before the usual rounding, in addition to crisis
and epidemic factors. Residential tax and maintenance stay unchanged. The counter resets only
after the budget is applied. Switching off does not erase the accrued reduction; half a month
costs 10%, a full month costs 20%. This is a citywide abstraction of reduced business activity,
not a per-lot production model. Water service improvements can offset part of the cost through
growth, so the policy is a tradeoff rather than a guaranteed loss in final treasury balance.

The optional `oasis.waterPolicy` record persists the choice and counter. Saves without it use
normal supply and retain their previous state shape and hashes. The decoder validates the
boolean and an integer counter no greater than elapsed ticks in the current month. Classic cities reject the
command, omit this state and do not apply the revenue multiplier.

The survival panel opens a keyboard-accessible water-management dialog with exact demand
alternatives for the current building mix and the accrued monthly business-tax reduction.
All figures come from engine statistics; the dialog neither forecasts final revenue nor
changes speed. Opening it is cosmetic. Escape closes it without triggering map shortcuts.

Adobe residential and commercial frontages show a filled trough while watered and green
planters only while both watered and shaded. Empty troughs and dry planters indicate the
missing conditions. These details are cosmetic, use theme tokens and redraw with dirty chunks;
they disappear under network overlays, underground and on abandoned lots. No new simulated
vegetation or shade source is created.

Validation covers near-capacity recovery, stress relief, disconnected lots, reserve spending,
repeated toggles, proportional business taxes, mid-month save/replay, legacy and malformed saves,
and classic isolation. A long scenario and the `oasis-rationing` preset exercise a growing city;
Playwright covers the actual worker command, dialog, changed consumption, save/import,
deactivation with accrued cost retained, and a smaller viewport.

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

### Event presentation

The adobe renderer presents real Oasis events with bounded, cosmetic signals: sandstorms
produce a twelve-second dust front and a marker at the targeted service; successfully blocked
storms use a lighter front and a confirmation marker. Spring movement, caravan transactions
and water incidents also mark their reported locations. These effects do not forecast storms,
change the engine RNG, alter network flags or extend a service's outage. Their duration is in
presentation seconds, independent of simulation speed, and freezes when the game is paused.

Dust uses a fixed pool of 72 streaks and nine veils; at most eight map signals are retained.
The graphics update at most 30 times per second, without full-map scans or post-processing
filters. Underground and network overlays hide the effects to preserve inspection readability.
Disabling animations or requesting reduced motion clears the effects; the report remains usable.
Wind and spring cues use the existing sound bus and honour mute.

The Oasis chronicle retains twelve reports during the current city session, with localized
descriptions, observation dates, map locations and relevant tool shortcuts. Caravan bursts in
one worker update are grouped. A storm report takes precedence over its accompanying spring
movement. Reports describe past events, not a claim that a service is still offline. Opening a
report never moves the camera automatically; the player chooses “Show on map”. Loading or
founding a city clears the journal and visual effects. The journal is not part of saved state.

Validation includes replaying a saved city through a naturally generated storm, locating the
affected service, selecting a windbreak, freezing and disabling effects, reloading a city and
using the same actions under reduced motion. Presentation actions preserve the simulation hash.
The 120-month `oasis-balanced` rerun also retains the reference hashes for seeds 1–3:
`6dda1252`, `6a82429f`, `2967728c` (reports in `reports/events/`).

## Arcades

An arcade eases traffic on the streets beside it while it is powered and online. The
road is required when it is placed. The adobe theme does not draw drones.

## Saves

Oasis cities use the envelope `oasis-city-save` and the extension `.oasis.json`.
A classic file stays classic when opened here.
