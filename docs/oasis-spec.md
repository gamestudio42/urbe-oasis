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
The inspector calls the engine's grass terrain "Desert ground" in the Oasis catalogs,
matching its dry appearance. This naming does not change terrain IDs, saves or city rules;
water, shoreline sand, dirt and rock retain distinct names. Classic catalogs remain unchanged.

The first founding starts paused, centred on the spring. A ten-step tutorial guides the player
through an edge-connected road, homes, jobs, power, water, shade, the first residents and a
charged cistern. Tool shortcuts select the real construction tools. Completion reads engine
telemetry and mirror-world service flags; it does not grant resources or change growth rules.
The shade step requires a residential tile with both water and shade. The cistern step requires
stored water, rather than merely placing the building. Completion is stored independently from
the classic tutorial under `oasis.tutorial.founding.v1`, with copy in all five supported locales.

The Oasis guide presents one short action per step, ordered tool buttons with actual catalog
prices, and expandable explanations. Selecting a tool folds the guide to free the map; its
header remains available. Coverage shortcuts use the existing power, water and shade overlays.
The guide stays above the measured construction dock and hides while a tool tray, inspector
or management panel is open. On phones its expanded sheet temporarily hides the resource card;
folding it restores the card. Escape folds the guide and returns focus to its toggle.

After founding, a collapsed guide offers optional, live goals: 100 residents, cisterns at least
half full, a completed non-negative operating report with residents, positive windbreak coverage,
and the first caravan receipt. These are presentation targets, not simulation rules, rewards or
new unlocks. Status is recomputed from current telemetry, may regress, and survives save/load
through the existing city data. The guide can reopen founding in a paused city without resetting
the world or its tutorial-completion preference. Classic cities retain the shared tutorial.

The survival panel shows served shares and supply/demand from engine statistics, plus cistern
charge and the number of placed cisterns. Empty cities display “No consumers”; unpowered
cisterns still count as placed buildings. Water and shade buttons toggle their overlays, the
reserve button selects the cistern tool, and the spring button recentres the surface view.
The three resource indicators have equal content widths and internal spacing in a 600 px
desktop panel, and share label, value and detail rows. Wrapped translations or
empty-state values expand their shared row, keeping adjacent indicators aligned without
truncating telemetry. On phone widths, the indicators stack with labels on the left and
values and details on the right. Browser checks cover empty and populated cities at narrow
and wide sizes.

The Oasis construction dock groups tools into six named categories. Opening a category shows
tool names, costs and population requirements from the shared catalog. Selecting a tool closes
the tray; Escape first closes an open tray and returns focus to its category without cancelling
the selected tool. Keyboard shortcuts and tutorial actions use the same shared controller.
The active tool remains visible above the dock. The classic toolbar is unchanged.

Construction previews show the planner's estimated cost, affected lots, existing infrastructure
and blocked lots. Text distinguishes ready, partial and rejected operations, alongside the map's
themed highlights. The card flips and clamps within the viewport above the measured construction
dock. Blocked operations without a complete price estimate do not display a misleading free cost.

Oasis building placement includes a translucent silhouette from the same sprite factory, variant,
footprint anchor and shoreline orientation as the finished building. It follows zoom and terrain
height, uses themed validity colors, and clears when hovering away, cancelling or loading a city.
It stays available with reduced motion because it is static planning information. It never adds
a building or modifies a tile in the mirror world. Successful placement clears the silhouette
until the next target or attempt, so the completed building does not immediately appear blocked.

After a tool command, a short dismissible receipt reports the worker's actual charged cost,
applied lots, skipped lots and rejection reason. Pending and unconfirmed commands have distinct
states; success is never inferred from the preview. The receipt retains the submitted tool name
if selection changes. Older responses cannot replace a newer receipt or leak across city loads
or a return to the menu. Receipts expire after seven seconds or when planning at another map
target, and are excluded from saves. Phone layouts temporarily hide secondary status panels
while planning, and show the receipt instead of a second preview until the next target.
Classic cities retain their shared tooltip and rejection toasts.

### Management panels

Management panels use a wider, responsive layout with fixed headers and scrollable bodies.
The budget leads with income, operating expenses and net balance from the last completed
monthly report, explicitly dated across year boundaries. Before the first close it shows a
pending-report message. Taxes and departmental funding still send the original commands;
construction spending stays separate from operating net. The annualized balance is labelled
as last month times twelve, not a forecast. Ledger rows keep their natural height.

The system panel separates save actions, display/audio preferences, keyboard help and
collapsed scenario tools. Manual disasters require an inline confirmation; cancelling it
does not issue a command. The random-disaster setting keeps its existing behavior. Panels
accept Escape from focused controls and restore focus to their opener; Escape first cancels
an active scenario confirmation. These panels are non-modal and do not change game speed.
Browser validation covers actual tax/funding commands, report values, keyboard focus,
confirmation/cancellation and narrow layouts, alongside the existing save and audio flows.

### Interface icons

The studio seal retains its original silhouette and link, using the theme's water accent,
panel background and light ink on hover or keyboard focus in the HUD, menu and boot screen.

The adobe theme has a complete collection for all 36 construction tools, separate category
symbols and matching system controls. Palms, canals, spring houses, qanats, cisterns, arcades,
windbreaks and caravanserais use their Oasis silhouettes instead of electronic metaphors.
The 32-unit SVGs share two-unit strokes; cards display them at 32 px, categories at 28 px
and supporting controls at 20 px. Selected tools have a check mark; locked tools retain their
silhouette with a lock badge and the localized population requirement. Lock presentation does
not change tool selection or command validation.

Icon colors come from `oasisIconCss` in the injected theme, scoped to the app root. Functional
accents support readable shapes and labels. The same definitions appear in the active tool,
tutorial, chronicle, survival panel, audio, speed, navigation and save controls. SVGs are
decorative and hidden from accessibility APIs; the controls keep their existing localized
names, keyboard behavior and focus indicators. Classic and cyber retain their previous icons.
When the inspector is open or the viewport is narrow, the chronicle follows the measured
resource-panel height so wrapped labels and status messages cannot overlap it.
Browser validation covers the full tool catalog, category identity, theme injection, selected
and locked states, audio states, keyboard focus, narrow viewports and unchanged simulation hash.

Floating panels reserve a separate right-hand rail for sound and music controls, with a gap
between the rail and the panel edges. Panels fit narrow viewports and sit above the resource
and chronicle cards; their headers remain outside the scrolling body. Browser checks at
320, 390, 800 and 1440 px verify real close-button clicks for terrain inspection, budget,
charts, overlays and the system menu, alongside independent audio toggles.

Adobe terrain uses smoothly interpolated deterministic color variation, sparse wind marks and
small stones. Undeveloped tiles adjacent to real water receive decorative banks and reeds.
These details are baked into terrain chunks, use theme colors and do not mutate world state,
consume simulation RNG, or supply water or shade. Diagnostic overlays omit surface details.

### Neighborhood architecture

Adobe zone buildings have eight cached appearances per use and level. The four original masses
retain their roofs and gain restrained furnishings; four additional footprints introduce open
house courts, exterior stairs, verandas, market stalls, galleries and workshop yards. Cloth,
rugs and goods disappear from abandoned lots, while the underlying footprint remains recognizable.
All colors come from the injected theme. These features are cosmetic and grant no shade or water.

The renderer combines the saved four-way variant with a stable coordinate-derived bit. It does
not modify the saved variant, consume engine RNG or change construction, growth or occupancy.
Texture keys include the resulting appearance but not individual coordinates, bounding reuse to
eight appearances per zone kind, level and abandonment state. Classic and cyber rendering keep
their original variant selection. Industrial smoke follows the visible adobe vent; timber and
masonry yards have no decorative smoke. This does not affect simulated pollution.

### Service landmarks

The adobe fire station and water pump keep their existing 2×2 footprints. The station has
two recessed engine bays, a lookout/drying tower, a paved exit apron and hose-service equipment.
The pump has a stone race, a wheel projected into the isometric vertical plane with separate
rims, spokes and lifting paddles, a shaft, a receiving basin and delivery fittings. Masonry,
roof edges and contact shading use the injected theme's existing material tokens.

These are cached, static architectural details. Decorative water, equipment and paving do not
create network tiles, storage, service capacity or vehicle spawns. The existing operating rules,
selection footprints and fire response remain unchanged. Classic and cyber retain their own
drawings. Browser checks inspect both footprints at native and enlarged zoom, capture the
landmarks among actual city lots, and verify that camera/inspection do not change the paused hash.

### Streets and planning

Adobe streets use their actual road connections and existing lane width. Near zoned lots or
buildings, including diagonal corners at intersections, pale paving fills the shoulders.
Curbs follow the connected road outline, leaving joins open. Urban junctions receive stone
crossings; straight roads have subtle wheel wear. Sparse benches occupy paved corners only.
Road tiles carrying canals retain exposed shoulders, and raised bridges keep their existing
geometry. These details are cosmetic: they add no services, capacity or pedestrian simulation.

Inspection mode uses neutral occupied lots and faint, merged vacant-zone boundaries to reduce
visual clutter. Survey pegs still distinguish light and dense zoning. Selecting any construction
tool restores the complete colored plan; returning to inspection quiets it again. The grid and
diagnostic overlays always reveal the complete plan. Opening a category alone does not change
the active tool or plan. The menu clears construction mode. Classic rendering is unchanged.

All details use theme colors and cached chunk graphics. Changing a parcel at a chunk corner
also redraws the diagonal chunk so neighboring street paving cannot become stale. Validation
covers all sixteen road connection masks against actual vehicle paths, canal and bridge
preservation, chunk boundaries, classic isolation and simulation hash stability. Browser checks
exercise construction shortcuts and the grid toggle alongside the responsive dock.

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
The Oasis app stores browser saves in its own `urbe-oasis` IndexedDB database so games
hosted on the same origin cannot appear in its menu. Existing Oasis saves in the former
shared `city-builder` database are copied on first access and left untouched there.

## Music and audio preferences

Oasis has an original procedural score, generated locally through Web Audio without downloads
or external samples. The menu uses a sparse D minor pentatonic theme at 72 BPM; the city uses
D Dorian at 82 BPM. Sixteen-bar phrases build from open fifths and plucked-string synthesis to
breathy flute and soft frame-drum tones, then return to a sparse passage. Filtered noise adds
quiet wind and water-like ambience. These are synthesized approximations, not sampled instruments.
Composition uses its own seeded random stream, never the simulation RNG.

Music starts after a user gesture, crossfades between menu and city, and becomes quieter and
darker while paused. A separate pause gain preserves attenuation when music is toggled off/on.
The music switch controls the score and its ambience; master mute also controls sound effects.
Audio nodes and timers are released on disposal, and completed notes disconnect their nodes.

Preferences use `oasis.audio.muted` and `oasis.audio.music`. Classic `cityBuilder.*` audio keys
remain unchanged and are not migrated: they cannot reliably identify which sibling game the
player muted on the shared hosting origin. New Oasis preferences default to sound and music on,
subject to the browser's gesture requirement. Composer tests cover modal pitch, phrasing and
repeatability; browser tests measure real audio output, mute, restart and preference persistence.

The Oasis mix accounts for attenuation in the shared music and master buses. Bass, pad and
flute hold their note body before release; plucked strings and drums decay immediately.
A quiet upper bass harmonic preserves presence on small speakers. Browser regression checks
sample the final master output after startup fades, checking audible sustained levels between
notes as well as mute and restart behavior. Classic music and sound-effect levels are unchanged.
