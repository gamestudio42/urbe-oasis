import { mix, type Theme } from '@theme/core';
import { urbe } from '@theme/urbe';

/**
 * Urbe Oasis: dusk sand, terracotta and a little turquoise for water.
 *
 * Colours live in this table. The renderer never hardcodes a hue. `style: 'adobe'` selects the
 * mud-brick zone, civic and utility silhouettes; the classic shapes stay on the Urbe theme and
 * the armoured ones stay on Neo Urbe. Tokens without an override are warmed from Urbe.
 */

/** Recolour a value towards `target` by `amount` (0..1). */
const towards = (value: number, target: number, amount: number): number =>
  mix(value, target, Math.max(0, Math.min(1, amount)));

/** Warm the leftover Urbe colours toward sand and fired clay. */
const grade = (value: number): number => {
  const warm = towards(value, 0xc4a574, 0.22);
  return mix(warm, 0x8d5a3c, 0.08);
};

const OASIS_OVERRIDES: Record<string, number> = {
  // Ground is packed sand, with a darker skirt where the tile meets the next.
  'ground.skirt': 0x8d7355,
  'ground.waterEdge': 0x123a52,
  'ground.outline': 0x3a2a22,
  'ground.undergroundWater': 0x0d2233,
  'ground.undergroundLand': 0x3a2e24,
  'ground.bareLot': 0xe4d2a8,

  // Smoke and fire keep their warmth: they are the only natural light in the scene.
  'fx.flameOuter': 0xff6a1f,
  'fx.flameInner': 0xffd24a,

  // Roads: packed earth, a lighter track, timber bridge rails.
  'road.surface': 0xc4a574,
  'road.edge': 0x8d7355,
  'road.mark': 0xf3e6d0,
  'road.bridge': 0xb89a62,
  'road.bridgePier': 0x6b4423,
  'road.bridgeRail': 0xc4784a,
  'road.bridgeSide': 0x8d5a3c,
  'road.bridgeShadow': 0x1c1410,
  'road.bridgeMark': 0xd4a24a,

  // Infrastructure glows.
  'infra.pipe': 0x2a9d96,
  'infra.pipeDry': 0x8d7355,
  'infra.canal': 0x1a6e78,
  'infra.canalDark': 0x3e5c56,
  // Sheath of a power line. Adobe draws a warm core instead of this water colour.
  'infra.wire': 0x6b4423,
  'infra.wireCut': 0xc4512c,
  'infra.rubble': 0x2c2b33,
  'infra.flood': 0x1c6fa8,

  // Overlays stay legible on dark ground.
  'overlay.powerOn': 0xffd21f,
  'overlay.waterOn': 0x1f8a86,
  'overlay.dataOn': 0xd4a24a,
  'overlay.unserved': 0xc4512c,
  'overlay.heatLow': 0x6d9a48,
  'overlay.heatMid': 0xffd21f,
  'overlay.heatHigh': 0xc4512c,
  'overlay.goodLow': 0xc4512c,
  'overlay.goodMid': 0xffd21f,
  'overlay.goodHigh': 0x1f8a86,

  // Selection.
  'highlight.okFill': 0x6d9a48,
  'highlight.okStroke': 0x8affd8,
  'highlight.badFill': 0xc4512c,
  'highlight.badStroke': 0xff9ab4,
  'highlight.neutralFill': 0x8a93a6,
  'highlight.neutralStroke': 0xf2f6ff,
  'highlight.hover': 0xffffff,

  // Palms: a brown trunk and a dry green crown.
  'tree.trunk': 0x6b4423,
  'tree.leafDark': 0x3d6a32,
  'tree.leafMid': 0x5c8a45,
  'tree.leafLight': 0x7d9a52,

  // Vehicles.
  'vehicle.truckBody': 0x3a4150,
  'vehicle.fireBody': 0xc4512c,
  'vehicle.fireLadder': 0xd8dbe4,
  'vehicle.fireLightOn': 0xc4512c,
  'vehicle.fireLightOff': 0x1f8a86,
  'vehicle.fireLightDark': 0x3a1020,
  'vehicle.fireLightGlow': 0xc4512c,
  'walker.robeA': 0xf3e6d0,
  'walker.robeB': 0x1a6e78,
  'walker.robeC': 0xc4512c,
  'walker.robeD': 0xd4a24a,
  'walker.head': 0x8d5a3c,
  'camel.body': 0x8f5f3a,
  'camel.shade': 0x553823,
  'camel.load': 0x1a6e78,
  'camel.loadAlt': 0xc4512c,

  // Aircraft and a sand-coloured field.
  'plane.body': 0xe4d2a8,
  'plane.wing': 0xc4a574,
  'plane.engine': 0x6b4423,
  'plane.cockpit': 0x1a6e78,
  'plane.accent': 0xc4784a,
  'airport.asphalt': 0xc4a574,
  'airport.taxiway': 0xb89a62,
  'airport.apron': 0xd4c4a0,
  'airport.paint': 0xf3e6d0,
  'airport.yellow': 0xffd21f,
  'airport.light': 0xffd21f,
  'airport.grass': 0x7d9a52,
  'airport.terminalWall': 0xc4896a,
  'airport.terminalRoof': 0xe4d2a8,
  'airport.terminalWindow': 0xe8c872,
  'airport.towerGlass': 0xe8c872,
  'airport.mastLight': 0xc4512c,
  'airport.windsock': 0xff6a1f,

  // A timber pier, not painted steel.
  'marina.wood': 0xc4a574,
  'marina.woodEdge': 0x8d5a3c,
  'marina.pierWood': 0xb89a62,
  'marina.pierSide': 0x6b4423,
  'marina.clubRoof': 0xe4d2a8,
  'marina.clubWindow': 0xe8c872,
  'marina.flagCloth': 0xc4784a,

  'pole.post': 0x6b4423,
  'pole.arm': 0x8d5a3c,
  'boat.deck': 0xc4a574,
  'boat.sail': 0xf3e6d0,
  'boat.sailShade': 0xe4d2a8,
  'boat.wake': 0x9ad4d0,

  // Qanat: a stone ring around turquoise water.
  'qanat.wall': 0xc4a574,
  'qanat.roof': 0x8d7355,
  'qanat.coil': 0x8d5a3c,
  'qanat.arc': 0x1a6e78,
  'qanat.busbar': 0xe8c872,

  // Cistern: a clay jar.
  'cistern.wall': 0xc17a45,
  'cistern.roof': 0xe4d2a8,
  'cistern.cell': 0xb56a3c,
  'cistern.charge': 0x1a6e78,
  'cistern.strip': 0xe8c872,

  // Windbreak: a mud wall with a green coping.
  'windbreak.wall': 0xa85a32,
  'windbreak.roof': 0xc4a574,
  'windbreak.rack': 0x8d5a3c,
  'windbreak.led': 0x7d9a52,
  'windbreak.dish': 0xe4d2a8,

  // Arcade: a covered walk of piers and a lintel.
  'arcade.deck': 0xe4d2a8,
  'arcade.deckEdge': 0xc4784a,
  'arcade.pad': 0xd4a574,
  'arcade.padRing': 0xc4784a,
  'arcade.beacon': 0xe8c872,
  'arcade.tower': 0xc17a45,
  'arcade.towerLamp': 0xe8c872,
  'arcade.droneBody': 0x6b4423,
  'arcade.droneTrim': 0xe4d2a8,
  'arcade.droneGlow': 0xe8c872,

  // Caravanserai: a courtyard with a gold gate.
  'caravanserai.wall': 0xc4896a,
  'caravanserai.roof': 0xe4d2a8,
  'caravanserai.window': 0xe8c872,
  'caravanserai.trim': 0x1a6e78,
  'caravanserai.sign': 0xd4a24a,
  'caravanserai.signGlow': 0xc4784a,
  'caravanserai.spire': 0x8d5a3c,
  'caravanserai.beacon': 0xc4512c,

  // Civic: fired clay, sand roofs, a small gold opening. Each keeps one cue.
  'hospital.wall': 0xc4896a,
  'hospital.roof': 0xf0e2c4,
  'hospital.window': 0xe8c872,
  'hospital.cross': 0xf4f0e4,
  'hospital.padMark': 0xf4f0e4,
  'hospital.glow': 0x7d9a52,
  'police.wall': 0xc17a45,
  'police.roof': 0xe4d2a8,
  'police.window': 0xe8c872,
  'police.star': 0xc4512c,
  'police.glow': 0xc4784a,
  'police.beacon': 0xc4512c,
  'fire.wall': 0xb56a3c,
  'fire.roof': 0xc4a574,
  'fire.window': 0xe8c872,
  'fire.door': 0x5c3318,
  'fire.glow': 0xffd21f,
  'fire.ladder': 0x6b4423,
  'school.wall': 0xd4b483,
  'school.roof': 0xf0e2c4,
  'school.window': 0xe8c872,
  'school.pole': 0x6b4423,
  'school.flag': 0xc4512c,
  'school.glow': 0xd4a24a,
  'school.banner': 0xc4784a,

  // Kiln, jars, a sail and a stone well.
  'coal.wall': 0x6b3a28,
  'coal.roof': 0x4a2a1c,
  'coal.window': 0xffb060,
  'coal.stack': 0x8d5a3c,
  'coal.silo': 0x5c4030,
  'coal.glow': 0xff6a1f,
  'gas.wall': 0xc4a574,
  'gas.roof': 0xe4d2a8,
  'gas.window': 0xe8c872,
  'gas.tankBody': 0xd7b48a,
  'gas.tankTop': 0xe8d0a0,
  'gas.tankRim': 0x8d5a3c,
  'gas.glow': 0x1a6e78,
  'gas.flare': 0xff6a1f,
  'pump.wall': 0xb56a3c,
  'pump.roof': 0xc4a574,
  'pump.window': 0xe8c872,
  'pump.tank': 0x1a6e78,
  'pump.tankTop': 0x2a9d96,
  'pump.glow': 0x7ec8c4,
  'pump.frame': 0x6b4423,
  'well.wall': 0x8d7355,
  'well.roof': 0xc4a574,
  'well.window': 0xe8c872,
  'well.pipe': 0x6b4423,
  'well.pipeTop': 0x8d5a3c,
  'well.base': 0x5c4030,
  'well.glow': 0x1a6e78,
  'wind.tower': 0x6b4423,
  'wind.blade': 0xf3e6d0,
  'wind.hub': 0x8d5a3c,
  'wind.glow': 0x7d9a52,
};

const colors: Record<string, number> = {};
for (const [token, value] of Object.entries(urbe.colors)) {
  colors[token] = OASIS_OVERRIDES[token] ?? grade(value);
}

/** Lot paint: one terracotta city. Roofs are the same clay, a little lighter than the walls. */
const adobeLot = (wall: number, roof: number, window: number | undefined, accent: number) => ({
  wall: mix(grade(wall), 0xd4653a, 0.8),
  roof: mix(grade(roof), 0xe7b08a, 0.74),
  ...(window === undefined ? {} : { window: mix(window, 0x4a3024, 0.72) }),
  accent: mix(accent, 0x8d4030, 0.6),
});

export const oasis: Theme = {
  id: 'oasis',
  style: 'adobe',
  background: 0x1c1410,

  terrain: [0x1a6e78, 0xe4d2a8, 0xd1b581, 0xbda071, 0x8d7355],
  zone: [0x000000, 0xc4784a, 0x1f8a86, 0xd4a24a],
  lot: [0, 0xc4a07a, 0x8fb8b2, 0xb89a62],

  housePalettes: urbe.housePalettes.map((p) => adobeLot(p.wall, p.roof, p.window, p.accent)),
  towerPalettes: urbe.towerPalettes.map((p) => adobeLot(p.wall, p.roof, p.window, p.accent)),
  commercialPalettes: urbe.commercialPalettes.map((p) =>
    adobeLot(p.wall, p.roof, p.window, p.accent),
  ),
  industrialPalettes: urbe.industrialPalettes.map((p) =>
    adobeLot(p.wall, p.roof, p.window, p.accent),
  ),
  abandoned: adobeLot(
    urbe.abandoned.wall,
    urbe.abandoned.roof,
    urbe.abandoned.window,
    urbe.abandoned.accent,
  ),

  boats: urbe.boats.map((c) => mix(grade(c), 0xc4a574, 0.45)),
  cars: [0xc4512c, 0xc4a574, 0xffd21f, 0xf3e6d0, 0xd4a24a, 0x6b4423],

  colors,
};

/** Interface accents stay legible on the dark Oasis panels. */
export const oasisIconCss: Readonly<Record<string, string>> = {
  '--icon-ink': '#f3e6d0',
  '--icon-neutral': '#f3e6d0',
  '--icon-water': '#80c7bd',
  '--icon-shade': '#b2c884',
  '--icon-energy': '#e9c477',
  '--icon-clay': '#e2a27f',
  '--icon-stone': '#d4bb90',
};

/** CSS custom properties for the oasis shell. */
export const oasisCss: Record<string, string> = {
  ...oasisIconCss,
  '--bg': '#1c1410',
  '--panel': '#2a2118',
  '--panel-edge': '#6a5340',
  '--ink': '#f3e6d0',
  '--ink-dim': '#b7a48a',
  '--cyan': '#1f8a86',
  '--magenta': '#c4784a',
  '--amber': '#ffd21f',
  '--green': '#6d9a48',
  '--danger': '#c4512c',
  '--violet': '#d4a24a',
};

/** Audio theme hooks: tempo and waveform choices for the desert composer. */
export const oasisAudio = {
  bpm: 104,
  /** Scale degrees in a natural minor, as semitone offsets from the root. */
  scale: [0, 2, 3, 5, 7, 8, 10, 12],
  /** Detune of the pad voice, in cents. */
  padDetune: 11,
  /** Bass waveform. */
  bassWave: 'sine' as const,
  /** Lead waveform. */
  leadWave: 'triangle' as const,
} as const;
