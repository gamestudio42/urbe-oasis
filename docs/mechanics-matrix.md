# Mechanics matrix

Every mechanic is tagged with its provenance:

- **Code** — behaviour confirmed by reading the Micropolis source (GPLv3, derived from the 1989
  SimCity). We reimplement the idea, never the code.
- **Observed** — behaviour of SimCity 2000 known from play or from the OpenSC2K documentation,
  not confirmed by source code we can read.
- **New** — rule designed for this game.

References studied (cloned into the git-ignored `references/` folder):

- `micropolis/MicropolisCore/src/MicropolisEngine/src/*.cpp`: `simulate.cpp` (phase cycle,
  `setValves`, `collectTax`, `doFire`), `zone.cpp` (`doResidential`, `evalRes`, `doResIn`,
  `doResOut`), `power.cpp` (`doPowerScan`), `traffic.cpp` (`tryDrive`), `scan.cpp`
  (`pollutionTerrainLandValueScan`, `crimeScan`), `budget.cpp`, `evaluate.cpp`.
- `OpenSC2K/docs/native-simulation.md`, `OpenSC2K/docs/disasters.md`.

## Matrix

| System      | Mechanic                                                    | Provenance | Notes                                                                 |
| ----------- | ----------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| Clock       | Work spread over phases instead of one big update           | Code       | Micropolis has 16 phases; we use tick/day/month/year frequencies.     |
| Clock       | Tick = 1/4 day, month = 30 days                             | New        |                                                                       |
| Map         | Grid with corner heights and slopes                         | Observed   | SC2000 terrain. Our heights are 0..12.                                |
| Map         | Adjacent vertex heights differ by at most 1                 | Observed   | Constraint used by SC2000 terrain tools.                              |
| Map         | Raise/lower move a rectangle by ±1 then relax slopes        | Observed   | SC2000 raise/lower land. Same BFS and refusals as our level tool.     |
| Roads       | Road on water is a bridge (cost, upkeep, one component)     | Observed   | No extra Infra bit. Renderer draws a raised deck, piers and railings. |
| Terrain gen | Value noise, rivers by random walk, sea by percentile       | New        |                                                                       |
| Zoning      | Zones develop only with power                               | Code       | `doResidential`: unpowered `zscore = −500`.                           |
| Zoning      | Zone growth = global demand + local evaluation + randomness | Code       | `zscore = resValve + evalRes()` compared against a random number.     |
| Zoning      | Residential local value = land value − pollution            | Code       | `evalRes`. Extended with the blueprint attractiveness weights.        |
| Zoning      | Attractiveness weights (section 5)                          | New        | Blueprint weights, calibrated by scenarios.                           |
| Zoning      | Light/dense zones, level caps                               | Observed   | SC2000 has light and dense zones. Caps are ours.                      |
| Zoning      | Water required above level 2                                | Observed   | SC2000 limits growth without water; the threshold is ours.            |
| Zoning      | Pollution > 128 blocks residential immigration              | Code       | `doResIn`. We use a weight instead of a hard cut.                     |
| Zoning      | Failed commute causes emigration                            | Code       | `doResidential`: `makeTraffic == −1` → `doResOut`. See next row.      |
| Zoning      | No destination zone on the road component → no growth       | Code       | Micropolis looks for a zone of the target type, even empty. Ours too. |
| Demand      | Demand is integrated over time (valves)                     | Code       | `setValves` adds a velocity to each valve. We smooth by 50%/month.    |
| Demand      | Employment ratio drives residential migration               | Code       | `employment = (comHist + indHist) / normalizedResPop`.                |
| Demand      | Commercial driven by the internal market                    | Code       | `internalMarket = totalPop / 3.7`.                                    |
| Demand      | Industrial driven by an external market                     | Code       | `projectedIndPop = indPop · laborBase · extMarketParam`.              |
| Demand      | Tax table: higher tax lowers every valve                    | Code       | `taxTable[21]`, neutral around 7%. We use `T = (t − 7)/13`.           |
| Demand      | Formula of section 4                                        | New        | Blueprint hypothesis with explicit normalization.                     |
| Demand      | Regional bonus for roads on the map edge                    | Observed   | SC2000 neighbour connections. Value is ours.                          |
| Hubs        | Marina (shore) and airport as late unlocks with jobs        | Observed   | SC2000 seaport/airport idea. Shore siting, jobs and market are ours.  |
| Hubs        | Hub jobs scale with population, shared per kind, capped     | New        | `base + per1000 · P / 1000 / n`, market 2 per job.                    |
| Hubs        | Operating hub links its road to the region like an edge     | New        | Inspired by SC2000 connections; the gateway rule is ours.             |
| Hubs        | Marina raises nearby land value, airport noise lowers it    | New        | Linear falloff over a Chebyshev radius around the footprint.          |
| Note        | `resRatio = min(indRatio, indRatioMax)` typo in Micropolis  | Code       | Known bug; not reproduced.                                            |
| Power       | Flood fill from plants through conductive tiles             | Code       | `doPowerScan`.                                                        |
| Power       | Plant capacity limits the number of powered tiles           | Code       | Coal 700, nuclear 2000 units in Micropolis.                           |
| Power       | Consumption per building level, nearest-first allocation    | New        | Micropolis counts tiles; we count building consumption.               |
| Power       | Zones conduct power                                         | Code       | `CONDBIT` on zone tiles.                                              |
| Water       | Pumps, pipes, buildings relay water                         | Observed   | SC2000 has pumps and pipes. Relay through buildings is ours.          |
| Water       | Pumps need power and output more next to water              | Observed   | Values are ours. The 1×1 well uses the same rule at about 1/5 output. |
| Traffic     | Trips from zones to destinations within a max distance      | Code       | `tryDrive`, `MAX_TRAFFIC_DISTANCE = 30`.                              |
| Traffic     | Aggregated flow with Dijkstra and congestion feedback       | New        | Replaces Micropolis' random walk.                                     |
| Traffic     | Congestion averaged over months                             | New        | Avoids the empty/jammed oscillation of a single bottleneck road.      |
| Traffic     | Traffic produces pollution                                  | Code       | Heavy traffic pollution 75 in `getPollutionValue`.                    |
| Land value  | Distance to city centre, terrain, pollution, crime          | Code       | `pollutionTerrainLandValueScan`.                                      |
| Land value  | Services, parks, water proximity                            | Observed   | SC2000 land value factors. Weights are ours.                          |
| Crime       | `128 − landValue + density − police`                        | Code       | `crimeScan`. We add abandonment.                                      |
| Pollution   | Sources blurred by smoothing passes                         | Code       | `doSmooth1/2`.                                                        |
| Services    | Station effect scaled by funding                            | Code       | `updateFundEffects`: `effect · spend / fund`.                         |
| Services    | Coverage along the road network                             | New        | Micropolis uses a radius on a coarse map.                             |
| Economy     | Tax = population × land value × rate                        | Code       | `taxFund = totalPop · landValueAverage / 120 · cityTax`.              |
| Economy     | Road, police and fire upkeep                                | Code       | `collectTax`: police 100, fire 100 per station.                       |
| Economy     | Separate R/C/I tax rates and department funding             | Observed   | SC2000 budget window. Values are ours.                                |
| Economy     | Bankruptcy after 12 months in debt                          | New        |                                                                       |
| Fire        | Fire spreads to burnable orthogonal neighbours at random    | Code       | `doFire`: 1/8 chance per neighbour per scan.                          |
| Fire        | Fire station coverage raises the chance of extinction       | Code       | `doFire`: rate 10 → 3 → 2 → 1 with coverage.                          |
| Fire        | Burnt tiles become rubble                                   | Code       | `randomRubble()`.                                                     |
| Fire        | Forests burn faster and spread less than buildings          | New        | Keeps forest fires subcritical on wooded maps.                        |
| Fire        | Coverage spreads along roads and scales with fire funding   | New        | Same service model as police (section 9 of the spec).                 |
| Disasters   | Flood rises from a shore onto low land, then recedes        | Observed   | SC2000 floods near water; our elevation rule and limits are new.      |
| Disasters   | Earthquake collapses or ignites buildings, cuts networks    | Observed   | SC2000 / Micropolis earthquake effects; probabilities are ours.       |
| Disasters   | Fire, flood, earthquake menu and random disasters           | Observed   | SC2000 disaster menu (OpenSC2K `disasters.md`).                       |
| Disasters   | Economic crisis, blackout, epidemic                         | New        |                                                                       |
| Diagnostics | "Why is this not growing" panel                             | New        |                                                                       |

## Neo Urbe (neon ruleset)

Everything below only runs with `ruleset: 'neon'`. Formulas live in
[docs/neon-spec.md](neon-spec.md), constants in `packages/shared/src/balance/neon.ts`.

| System        | Mechanic                                                      | Provenance | Notes                                                              |
| ------------- | ------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| Ruleset       | `classic`/`neon` stored in the snapshot and the save          | New        | Save v2; v1 migrates to `classic`.                                 |
| Ruleset       | Separate save envelope and extension for Neo Urbe             | New        | `neon-city-save` / `.neon.json`, so the games never mix files.     |
| Power         | Overload when demand reaches 90% of supply                     | New        | Reuses the classic component solver, including the road hop.       |
| Power         | Cascading blackout off a stressed component                    | New        | Takes a share of buildings offline for two days.                   |
| Power         | Substations add supply; batteries buffer charge                | New        | Charge is persisted per building.                                  |
| Power         | Demand ≥ 90% of supply stresses a component                    | New        | Same components the classic solver found, road hop included.       |
| Power         | A stressed, short component can blow into a cascading blackout | New        | 8% per day, 35% of its buildings offline for 2 days, via `rng`.     |
| Corporations  | Four agents with cash and a preferred quadrant                 | New        | Buy vacant zoned lots once a month.                                |
| Corporations  | Corporate lots stamp extra land value around them              | New        | Reuses the influence layer; averaged by the normal pass.           |
| Corporations  | Tax skim moves cash from the treasury to the corporation       | New        | Reported in `CityStats.neon.skimmed`.                              |
| Security      | Monthly intrusion chance grows with population                 | New        | Capped at 0.8.                                                     |
| Security      | Firewalls cut the chance and need power and a data link           | New        | Coverage scaled by distance inside the radius. A dark or unlinked node covers nothing. |
| Security      | A successful intrusion takes a service offline and steals cash | New        | Reuses the `offline` counter the utilities pass already respects.  |
| Traffic       | Drone ports relieve congestion on a separate aerial layer      | New        | A port counts only while powered, online and linked. The ground `traffic` layer is never written. |
| Traffic       | Aerial lanes derived from the road network beside each port    | New        | Read model rebuilt for the renderer; not serialized.               |
| Zoning        | Dense lots reach level 7, light lots level 3                   | Observed   | SC2000 has light/dense; the neon caps are ours.                    |
| Zoning        | Capacity, power and water extrapolate past the classic table   | New        | Exact at or below level 5, so the classic table stays the source.  |
| Data          | Fiber conducts bandwidth from a datacenter or an edge node     | New        | Third pass of the utility solver, after power and water. One road tile does not cut it. |
| Data          | Datacenter output needs power and a reached water network  | New        | 400 cooled, 120 dry, 0 offline. A pair covers the reference town. An edge node supplies 80 on power alone. A hacked hall still draws power. |
| Data          | A lot without a link stops at level 2                          | New        | Same ceiling as a lot without water. Both are required to go higher. |
| Data          | `linked` is optional in the save                               | New        | `SAVE_VERSION` stays 2. A neon file without the layer loads as zeros and rebuilds. |
