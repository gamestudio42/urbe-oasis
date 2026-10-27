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

## Urbe Oasis (oasis ruleset)

Everything below only runs with `ruleset: 'oasis'`. Formulas live in
[docs/oasis-spec.md](oasis-spec.md), constants in `packages/shared/src/balance/oasis.ts`.

| System   | Mechanic                                                                            | Provenance | Notes                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruleset  | `classic`/`oasis` stored in the snapshot and the save                               | New        | Save v2; v1 migrates to `classic`.                                                                                                            |
| Ruleset  | Separate save envelope and extension for Urbe Oasis                                 | New        | `oasis-city-save` / `.oasis.json`, so a classic file stays classic.                                                                           |
| Shade    | Canals and buildings conduct shade after the water pass                             | New        | The shade flag used for evaporation is the one from the previous pass.                                                                        |
| Shade    | A palm supplies 80 with no power and no water                                       | New        | A spring house supplies 400 when powered, watered and near the spring, else 120 or 0.                                                         |
| Shade    | A lot without water or shade stops at level 2                                       | New        | With both, dense stops at 5 and light at 2.                                                                                                   |
| Water    | An unshaded well or pump keeps 55% of its output                                    | New        | A qanat does not evaporate. It adds 260 while powered and needs no river.                                                                     |
| Water    | A spare cistern charges and does not add stored water                               | New        | A short component is topped up only by the missing water, and the charge falls by that share.                                                 |
| Water    | Demand at 90% of supply parches a component                                         | New        | Same water components the classic solver found.                                                                                               |
| Water    | A parched component with a qanat dries one qanat                                    | New        | Offline for two days, and the collapse toast fires. Without a qanat, a share of buildings goes offline and only the water-stress toast fires. |
| Spring   | The spring wanders from a seed and the month                                        | New        | Chebyshev radius 20, a step of 5 every 6 months. A sandstorm nudges it 2 tiles.                                                               |
| Caravans | Four houses buy watered or shaded vacant lots                                       | New        | The fee is paid into the treasury. A dry lot may be abandoned.                                                                                |
| Caravans | Buy and abandon need an open caravanserai                                           | New        | Powered and online. Without one, the month does not move cash.                                                                                |
| Storms   | A monthly sandstorm may bury a service                                              | New        | Sand does not take money. A storm that lands nudges the spring.                                                                               |
| Storms   | A windbreak lowers the chance inside its radius                                     | New        | It covers while powered and online. Shade is not required.                                                                                    |
| Traffic  | An arcade eases congestion on the streets beside it                                 | New        | It counts while powered and online. The adobe theme does not draw drones.                                                                     |
| Journey  | Five chapters with treasury grants, checked at the month close                      | New        | Only cities founded by the Oasis app. Goals and grants are original balance choices.                                                          |
| Journey  | A three-month dry season cuts wells and pumps to 60%                                | New        | Starts one close after the shelter chapter; no random draw. Qanats and cisterns are spared.                                                   |
| Era      | After the journey, three titles with grants at 1,500 / 4,000 / 8,000 residents      | New        | Goals add water, shade, shelter and charged cisterns. Original balance choices.                                                               |
| Era      | Dry seasons every two years grow longer and harsher, with a grant when held         | New        | Fixed calendar, no random draw. Wells and pumps from 55% down to 35%.                                                                         |
| Era      | Era dry seasons also cut qanats, a share of the well cut that grows from 50% to 80% | New        | Keeps qanats from making late dry seasons trivial; cisterns stay spared. The era stops escalating at its seventh season.                      |
| Era      | Dry-season grants grow for six seasons, then stay at $12,000                        | New        | Original balance choice: a city twenty years old has no use for an ever-growing grant.                                                        |
| Water    | Cisterns cover the gap left by a drought's cut                                      | New        | Measured before the cut, a dry season left the gap hidden and the banks kept charging.                                                        |
| Spring   | The spring stays within 8 tiles of the map centre                                   | New        | A step that would leave the range turns back. Balance choice from the 2026-10-25 pass.                                                        |
| Water    | Cisterns charge 1/240 of a bank per elapsed day of surplus                          | New        | Replaces a per-refresh increment; repeated construction no longer charges reserves.                                                           |
| Networks | Empty Oasis lots carry water and shade, as zones carry power                        | New        | Removes the gap while a lot waits for its building; classic water is unchanged.                                                               |

### Water-management decision

- **New:** optional Oasis rationing, per-lot demand `ceil(base * 0.75)`, shared by the water,
  storage and stress passes. The multiplier is an original balance choice.
- **New:** business tax multiplier `1 - 0.20 * rationedTicks / TICKS_PER_MONTH`, accumulated
  through the month and saved; residential receipts are unchanged. The 20% cost is an original
  tradeoff parameter, not a real-world consumption or economic estimate.
- **New presentation:** service-driven troughs and planters on adobe residential/commercial
  frontages. They read water and shade flags without supplying either resource.
