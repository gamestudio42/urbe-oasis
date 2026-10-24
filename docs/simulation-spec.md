# Simulation specification

This document defines the rules of the engine. Every numeric constant lives in
`packages/shared/src/balance/balance.ts`; the values quoted here are the initial calibration.
Each rule is classified in [mechanics-matrix.md](mechanics-matrix.md).

Notation: `clamp(v, a, b)`, all normalized inputs are in `[0, 1]` unless stated otherwise.
Byte maps (0..255) are normalized by dividing by 255.

## 1. World and terrain

- Grid `size × size` (default 128). Tile `(x, y)` has four corners: north `(x, y)`, east
  `(x + 1, y)`, south `(x + 1, y + 1)`, west `(x, y + 1)` in vertex coordinates.
- Vertex heights are integers `0..MAX_HEIGHT` (12). Adjacent vertices differ by at most 1.
- A tile is **flat** when its four corners are equal; its **elevation** is its lowest corner.
- Terrain generation (seeded): three octaves of value noise for height, a moisture noise for
  forests, one or two rivers carved by a seeded random walk, sea level by percentile, then a
  relaxation pass to enforce the slope constraint. Water tiles have all corners at height 0.
- Rules:
  - Water blocks zones and buildings. Roads over water are bridges (higher cost and upkeep,
    same `Infra.Road` bit); power lines may cross water; pipes are underground and may cross
    anything. The renderer lifts the deck and draws piers; the road graph is unchanged.
  - Zones and buildings need flat tiles (all footprint tiles flat and at the same height).
  - Roads, power lines and pipes accept flat tiles and simple slopes (`max − min ≤ 1`).
  - The level tool flattens a rectangle to the height of the drag start tile and propagates
    the slope constraint outwards; it is refused if a neighbour with construction would change.
  - Raise and lower move every vertex in the rectangle by +1 or −1 (clamped to `0..MAX_HEIGHT`)
    and reuse that same slope BFS and the same refusals. Cost is `units · levelPerUnit`.
    Raising a water tile so any corner is above 0 turns it into sand.
  - The marina (3×3) must sit on land, touch water and an orthogonal road, and needs 1 000
    residents. The airport (4×4) must be flat land with an orthogonal road and 2 000 residents.
    The population lock is checked first and rejects every footprint tile with `LOCKED`; then
    the per-tile checks run, and finally `NEEDS_WATER` and `NEEDS_ROAD` for the whole lot.

## 2. Construction

Commands are validated tile by tile. Invalid tiles are skipped and reported with the most
frequent `RejectReason`. If the total cost exceeds the funds, the whole command is refused.
Construction never makes funds negative. A bankrupt city cannot build.

| Tool       | Shape     | Notes                                                    |
| ---------- | --------- | -------------------------------------------------------- |
| Road       | L-path    | Clears trees. Bridge on water.                           |
| Power line | L-path    | May share a tile with a road.                            |
| Water pipe | L-path    | Underground layer, independent of the surface.           |
| Zone       | Rectangle | R/C/I, light or dense. Re-zoning needs an empty tile.    |
| Building   | Point     | Plants, pump, well, services, park, marina, airport.     |
| Demolish   | Rectangle | Removes whole buildings, networks, zones, trees, rubble. |
| Level      | Rectangle | Flatten to the drag-start height. Cost per vertex unit.  |
| Raise      | Rectangle | Each vertex +1, then the same slope BFS as level.        |
| Lower      | Rectangle | Each vertex −1 (no-op at height 0).                      |

Roads choose their sprite from a 4-bit mask of orthogonal road neighbours (auto-tiling).

## 3. Buildings

Zone buildings are 1×1 aggregated buildings: `level 1..5`, `capacity`, `occupancy`,
`condition 0..100`, `age` (months), `abandoned`.

| Level | Residents | Commercial jobs | Industrial jobs |
| ----- | --------- | --------------- | --------------- |
| 1     | 10        | 4               | 8               |
| 2     | 30        | 12              | 20              |
| 3     | 80        | 30              | 45              |
| 4     | 180       | 70              | 90              |
| 5     | 400       | 150             | 160             |

- Light zones cap at level 2, dense zones at level 5.
- Without water service a building caps at level 2.

## 4. Demand (RCI), monthly

Inputs: residents `P`, workforce `W = 0.45 · P`, job capacity `Jc`, `Ji`, housing capacity `Hc`,
tax rates `tR, tC, tI` (percent), tax pressure `T(t) = (t − 7) / 13`.

Residential (blueprint hypothesis `D_R = clamp(a1·J + a2·Q − a3·T − a4·H)`):

```
J  = clamp((Jc + Ji + EXTERNAL_JOBS − W) / max(W, 50), −1, 1)
     (Jc and Ji include the jobs of operating hubs, see "Transport hubs" below)
Q  = mean over developed residential tiles of (landValue − pollution − crime) / 255 − 0.15
     (0 while no residential building exists)
H  = max(0, (Hc − P) / max(Hc, 1) − 0.10)          (10% natural vacancy is tolerated)
DR = clamp(0.7·J + 0.3·Q − 0.5·T(tR) − 0.6·H, −1, 1)
```

Commercial:

```
labor  = clamp((W − (Jc + Ji)) / max(W, 20), −1, 1)
market = (0.20·P + 0.05·Ji + 2 + airportMarket − Jc) / max(0.20·P + 0.05·Ji + 2 + airportMarket, Jc, 10)
         airportMarket = 2 · (airport jobs)
DC     = clamp(0.8·market + 0.3·labor − 0.5·T(tC), −1, 1)
```

Industrial (external market grows with the city; a road on the map edge adds a regional bonus
of 0.1):

```
market = (30 + 0.25·P + marinaMarket − Ji) / max(30 + 0.25·P + marinaMarket, Ji, 10)
         marinaMarket = 2 · (marina jobs)
DI     = clamp(0.8·market·crisis + 0.4·labor − 0.5·T(tI) + edgeBonus, −1, 1)
```

Transport hubs. A hub **operates** when it is powered, not offline and has jobs. Its jobs grow
with the city and are shared by hubs of the same kind:

```
jobs = min(maxJobs, base + floor(P · per1000 / 1000 / max(1, operating hubs of that kind)))
       marina:  base 40, +25 per 1 000 residents, max 200, industrial jobs
       airport: base 60, +50 per 1 000 residents, max 600, commercial jobs
```

The utilities pass stores them as the hub's `capacity` and `occupancy` (0 when idle). The
market bonus is `hubMarketPerJob` (2) per job, so a hub pulls in as much trade as it employs.

The per-capita market factors (0.20 and 0.25) are tuned so that a balanced city keeps roughly
one job per resident in the workforce; lower values stall residential demand on `J`.

Smoothing: `demand ← demand + 0.5 · (target − demand)` every month.

## 5. Attractiveness, monthly per zone tile

```
residential = 0.25·access + 0.20·landValue + 0.15·services + 0.15·power + 0.10·water
            + 0.15·transport − 0.25·pollution − 0.20·crime
commercial  = 0.25·access + 0.20·landValue + 0.15·transport + 0.15·power + 0.10·water
            + 0.10·services + 0.05 − 0.15·crime − 0.10·pollution
industrial  = 0.25·access + 0.20·transport + 0.20·power + 0.05·water + 0.10·(1 − landValue)
            + 0.10·fireCover + 0.10 − 0.10·crime
```

- `access` is zone-specific (section 7): job access for R, customers for C, workers for I.
- `transport` is 1.0 / 0.7 / 0.4 for a road within 1 / 2 / 3 tiles (Chebyshev), multiplied by
  `1 − 0.5 · congestion` of that road, and 0 without road access.
- `services`: R uses the mean of police, fire, health and education coverage; C uses police
  and fire.

## 6. Growth, monthly per zone tile

Requirements for any development: road within 3 tiles and power.

- **Empty zone:** if `D > 0`, spawn a level-1 building with probability `0.5 · D · A`.
- **Occupancy:** target `= capacity · clamp(0.6 + 0.4·A + 0.5·D, 0, 1) · epidemic` for
  residential; job buildings use `capacity · clamp(laborRatio, 0, 1) · clamp(0.6 + 0.4·A, 0, 1)`
  with `laborRatio = (W + 10) / max(Jc + Ji, 1)`. Occupancy moves 35% of the gap per month
  (rounded away from zero, so it always converges). Without power or road the target is 0.
- **Upgrade:** occupancy ≥ 80%, `D > 0.02`, `A ≥ threshold(level)` (0.30, 0.45, 0.55, 0.65)
  and level below the cap: probability `0.25 · clamp(0.3 + 2·D, 0, 1)`. The bias keeps
  growing cities densifying while demand hovers near zero.
- **Downgrade:** occupancy < 30%, `D < −0.2`, level > 1: probability 0.2.
- **Decay:** condition −10 per month when `A < 0.15`, unpowered or without road; +5 otherwise.
  Condition 0, or six months empty, abandons the building.
- **Recovery:** an abandoned building with `A ≥ 0.35` and `D > 0.2` is restored at level 1 with
  probability 0.1.

## 7. Roads, accessibility and traffic, monthly

1. Road tiles form a graph with orthogonal edges; connected components are labelled by BFS.
2. Each tile gets an access road: a multi-source BFS over the 8-neighbourhood starting from
   all road tiles in index order, limited to Chebyshev distance 3. Ties go to the road reached
   first, which keeps the result deterministic. Roads are recomputed lazily, only when the
   world's `roadVersion` changes.
3. Per component: residents, workforce, commercial and industrial jobs, edge connection.
   A component touching the map edge counts as a source of external jobs and workers (the
   neighbouring region), so edge roads also seed the Dijkstra below. An operating marina or
   airport is a **regional gateway**: the road orthogonally next to its footprint (the first in
   index order) links its component to the region exactly like an edge road. It seeds the
   Dijkstra as a job and home site, satisfies trip generation and counts as edge-connected for
   the industrial `edgeBonus`. The hub itself is a job site of its component.
   **Trip generation:** a zone tile can develop (and its building keeps residents or workers)
   only if its road component contains a destination zone: any C or I zone tile for homes, any
   R zone tile for job sites, or a map-edge road. Empty zones count as destinations, so a new
   city can start. A failed trip behaves like a missing road (occupancy target 0).
4. Multi-source Dijkstra from job sites (C and I access roads) and from homes (R access roads).
   Edge cost `1 + 2 · max(0, congestion − 0.6)²` using last month's congestion. Ties are broken
   by tile index. The search stops at `3 · maxCommute`; distances are stored in float64 so heap
   keys compare exactly with stored values.
5. Distance decay: `1` up to 15 road tiles, linear to 0 at 50.
6. Access values:
   - R: `clamp((jobs + external) / max(workforce, 1)) · decay(distance to jobs)`
   - C: `clamp(0.12 · residents / max(commercial jobs, 4)) · decay(distance to homes)`
   - I: `clamp(workforce / max(jobs, 10)) · decay(distance to homes)`
7. Trip assignment: each residential building sends `0.45 · occupancy` commuters to its nearest
   job site and `0.25 · occupancy` shoppers to its nearest commercial site, following the
   Dijkstra parent pointers (any reachable path, even beyond `maxCommute`, so a jammed road
   does not empty itself the next month). Flow accumulates per road tile.
8. Congestion `= flow / capacity`, capacity `= 200 · (0.5 + 0.5 · transportFunding)`. The traffic
   map stores a moving average: `traffic ← round(0.5 · traffic + 0.5 · min(255, congestion · 128))`.

## 8. Power and water

Conductors:

- Power: power lines, building footprints and zoned tiles. Laying a power line on a zone or a
  building is refused with `ALREADY_BUILT`, because those tiles already conduct.
- Water: pipes and building footprints. Any placeable with `waterSupply > 0` (the 2×2 pump
  and the 1×1 well) only runs when powered and `offline === 0`.
- Conduction jumps over a single plain road tile between two conductors (a road with no line
  or pipe on it). This mirrors the classic behaviour where a street between two blocks does
  not break the grid; two or more road tiles in a row do.
- Empty zoned tiles orthogonally adjacent to a watered tile are marked watered, so a growing
  block can draw water before its first building appears.

For each component (flood fill from the plant or pump with the lowest building id): supply
is the sum of capacities; consumers are served in BFS discovery order until the first one
that does not fit (explicit nearest-first policy). That consumer and every later one are
unserved, which makes brownouts spread from the far end of the network.

| Element    | Power              | Water                                    |
| ---------- | ------------------ | ---------------------------------------- |
| Coal plant | +800 (3×3)         | –                                        |
| Gas plant  | +400 (2×2)         | –                                        |
| Wind       | +60 (1×1)          | –                                        |
| Pump       | −10                | +400 next to water, +150 otherwise (2×2) |
| Well       | −2                 | +80 next to water, +40 otherwise (1×1)   |
| Marina     | −8 (3×3)           | –                                        |
| Airport    | −16 (4×4)          | –                                        |
| Res L1..L5 | −1, 2, 4, 7, 12    | −2, 4, 9, 18, 36                         |
| Com L1..L5 | −3, 6, 10, 16, 25  | −2, 5, 10, 18, 30                        |
| Ind L1..L5 | −6, 12, 18, 25, 35 | −4, 8, 14, 20, 28                        |

Networks rebuild immediately after a successful tool command, and at the start of a day only
when something marked them dirty: growth at the month close (new, upgraded or emptied
buildings change demand), fires and disasters that destroy buildings, and loading a save.
Network state is derived (not serialized): it is a pure function of the saved world, so
loading a save does not need to rebuild it to keep the state hash identical.

The flood fill runs on typed arrays: a per-network conductor mask is built once per refresh,
and each building is tracked as unreached, unserved or served in a `Uint8Array` indexed by
building id. The visiting order (and therefore the nearest-first policy) is unchanged.

### Derived-work optimizations

The utility solver computes each building's supply once per network pass. It recomputes this
snapshot for power, water and shade separately: pumps read the power flags just solved, and
spring houses read the water flags just solved. It does not retain supplies between solves.
Consumers, BFS traversal, source order and the first-unserved cutoff are unchanged.

Temporary next-layer, visited, queue, building-state and supply arrays are reused per `World`
through a weak reference. Flags are cleared before every pass; building arrays grow geometrically
when ids require more space. Scratch memory never escapes in results or saves. It uses six bytes
per map tile plus nine bytes per reserved building id, excluding typed-array headers. Removing
buildings does not shrink the reservation; releasing the world releases its scratch storage.
Read-only statistics still do not settle cisterns or write service layers.

Construction previews count non-abandoned residential occupants directly, in building order.
They no longer compute unrelated employment and residential-quality totals just to check a
population unlock. This does not cache population or change unlock thresholds.

## 8.1 Clock

One tick is a quarter of a day; a month is 30 days (120 ticks). Each tick: queued commands run,
dirty networks rebuild at the start of a day, fires and disasters advance, custom systems run,
and the tick counter advances. The heavy monthly work is then staggered over the last ticks of
the month (`monthStage(tick)` in `time.ts`, keyed on `tick mod 120` after the increment), so no
single tick pays for all of it:

| `tick mod 120` | Stage     | Work                                                              |
| -------------- | --------- | ----------------------------------------------------------------- |
| 117            | traffic   | road graph, trip assignment, job accessibility, traffic map       |
| 118            | services  | service coverage                                                  |
| 119            | influence | road graph, pollution, land value, crime                          |
| 0              | close     | totals, demand, growth, budget, layer statistics, history, events |

Every stage writes its result into serialized layers (`traffic`, `jobAccess`, coverage,
influence maps), so a save taken between two stages resumes exactly where it stopped. Growth
recomputes the road component statistics at the close instead of reusing the traffic stage's
copy, because a city loaded between the stages never ran that stage in memory.

## 9. Services and influence maps, monthly

- Stations (police, fire, school, hospital; 2×2) need a road within 1 tile of the footprint.
  Coverage spreads along roads from the access roads up to radius `R` (22, 20, 24, 26 road
  tiles) with strength `255 · funding · (powered ? 1 : 0.5) · (1 − d / R)`. Each tile takes the
  best road coverage within 2 tiles, minus 15% per tile of distance. Tiles within 3 tiles of the
  station get full strength.
- Parks raise land value within radius 4.
- **Pollution:** sources (industry `18·level`, coal 120, gas 50, commerce `3·level`, traffic
  `0.3·traffic`, fire 80) blurred twice with a 5×5 box filter and multiplied by a gain of 4
  (the blur spreads a source over 25 tiles), minus `4·trees` and 20 near parks.
- **Land value:** `60 + water proximity (30) + 3·elevation + 2·trees + parks + 0.1·(education +
health) + 0.05·police + 10·(road access) + hubs + city centre bonus max(0, 40 − d/2) −
0.5·pollution − 0.3·crime − 0.1·traffic`, blurred once. `hubs` sums, for each operating hub,
  `landValue · (1 − d / (radius + 1))` with `d` the Chebyshev distance to its footprint, up to
  `radius`: the marina's waterfront adds +30 within 6 tiles, the airport's noise −35 within 5. Water tiles are 0. The distance to water is a capped
  search over the terrain, cached per world and recomputed only when `world.terrainVersion`
  changes. `setLayer('terrain', …)` bumps that version; code that writes the terrain array
  directly (tests, generators) must bump it too.
- **Crime** (developed tiles): `40 + 12·level + 90·abandoned + (128 − landValue)/2 − 0.6·police`,
  blurred once.

The radius-one and radius-two blur interiors use fixed offsets. Their additions retain the
original left-to-right horizontal and top-to-bottom vertical order, including the initial zero
and Float32 rounding between passes. Edges and other radii keep the general loop. This avoids
repeated accumulator writes without changing floating-point rounding or the resulting byte maps.
Tests compare the separable definition across small and large windows, signed values,
cancellation, infinities and NaNs. Stored reference hashes cover classic, Oasis and rationed
cities at months 12, 24 and 36; saves taken after traffic also reproduce the next monthly close.

## 10. Economy, monthly

```
revenueR = Σ residents · (0.6 + landValue/255) · tR/100 · 3.0
revenueC = Σ commercial workers · (0.6 + landValue/255) · tC/100 · 4.0
revenueI = Σ industrial workers · tI/100 · 3.5
balance(t+1) = balance(t) + revenue − expenses
```

Expenses are monthly upkeep (roads 0.25/tile, bridges 1/tile, power lines 0.05/tile, pipes
0.05/tile, plants, pumps, stations, parks) multiplied by the department funding (transport,
police, fire, health, education; 0..100%). Power and water upkeep is fixed.

Debt: every month with a negative balance increments `monthsInDebt`; twelve consecutive months
declare bankruptcy (no construction until the balance is positive again).

Starting funds by difficulty: easy 20 000, normal 10 000, hard 5 000.

## 11. Events and disasters

Implemented in `systems/disasters.ts`. Fires and active disasters advance every tick, before
custom systems; random ignition and random disasters are drawn at the end of the monthly
pipeline, only when `disastersEnabled` is on (scenario cities built with `flatCity` start with
it off).

- **Fire** (tick). `cover = fireCover / 255` (station coverage, which reaches tiles through the
  road network and scales with fire funding).
  - Flammability: a building tile = 1; a wooded tile = `0.4 · trees / 3`; anything else = 0.
    Flooded and water tiles never burn.
  - Each burning tile, in index order: with probability `0.002 + 0.05 · cover` (or always, if
    flooded) the fire is put out and the building loses `0.25 · intensity` condition.
    Otherwise every orthogonal neighbour ignites with probability
    `0.025 · flammability · (1 − 0.8 · cover_neighbour)`, and the intensity grows by 1.
  - Burnout: at 100 (buildings) or 30 (forest) the tile burns out. The whole building becomes
    rubble; a forest tile loses its trees.
  - Spontaneous ignition (monthly): `0.0005 · (1 − cover)` per building.
  - With full coverage a fire is out in ≈ 19 ticks and rarely spreads; with none, a solid block
    of buildings burns almost entirely in about three months. Forest fires are subcritical:
    they die out after burning a patch.
- **Flood** (needs a shore tile, one at a time): starts at the nearest shore tile to the
  requested point (or a random one) and lasts 30 days. During the first 10 days, once a day,
  every land tile next to the water with elevation ≤ origin + 1 floods with probability 0.5,
  up to 60 tiles. Every day a building touching the water loses 4 condition and is destroyed
  with probability 0.02. When it ends, the water recedes from every tile.
- **Earthquake** (instant): epicentre at the requested point or a random building. A building
  at distance `d < 20` is hit with probability `0.5 · (1 − d / 20)`: 60% collapse into
  rubble, the rest catch fire. Roads and power lines are cut (rubble) with probability
  `0.3 · 0.5 · (1 − d / 20)`.
- **Economic crisis:** 12 months, `crisis = 0.6` in industrial demand, revenue × 0.8.
- **Blackout:** a random running plant is offline for 30 days (supply 0), then restored.
- **Epidemic:** 6 months; residential occupancy target × (0.85 + 0.15 · health coverage),
  commercial revenue × 0.85.
- Crisis and epidemic do not stack. Random disasters (if enabled): 1.5% per month, the kind
  drawn uniformly among the six.
- Destroyed buildings emit `buildingDestroyed` with the cause; rubble blocks growth until it
  is bulldozed.

## 11.1 Save format

`@city/shared/schemas/save.ts`. A save is JSON:

```json
{ "format": "city-builder-save", "version": 1, "meta": { … }, "state": { … }, "checksum": "…" }
```

- `state` is the `EngineSnapshot` with every byte layer in base64; `meta` repeats name, seed,
  size, tick, population, funds and `savedAt` for listing.
- `checksum` = FNV-1a over the canonical JSON of `state` (sorted keys), so formatting does not
  matter but any edit does.
- Decoding order: parse → format → version (newer → refused) → checksum → migrations
  `n → n + 1` registered in `SAVE_MIGRATIONS` → structural validation (sizes, ranges, known
  kinds, building overlaps; up to 20 problems reported with their paths) → snapshot.
- Error codes: `NOT_JSON`, `NOT_A_SAVE`, `NEWER_VERSION`, `UNSUPPORTED_VERSION`, `CHECKSUM`,
  `MIGRATION_FAILED`, `INVALID`. A failed decode never touches the running city.
- `hashState` hashes the canonical JSON as well, so a decoded save hashes like the original.

## 12. Diagnostics

`diagnoseTile(world, buildings, stats, x, y)` returns problem codes ordered by severity:
`NO_ROAD`, `NO_POWER`, `BROWNOUT`, `NO_WATER_FOR_LEVEL`, `LOW_DEMAND`, `NO_JOB_ACCESS`,
`NO_CUSTOMERS`, `NO_WORKERS`, `POLLUTION`, `CRIME`, `LOW_LAND_VALUE`, `CONGESTION`,
`HIGH_TAXES`, `SLOPE`, `ABANDONED`, `ON_FIRE`, `RUBBLE`, `FLOODED`, `MAX_LEVEL`. The UI
translates each code into the player's language.
