import { shade, mix, type Theme } from '@theme/core';
import { urbe } from '@theme/urbe';

/**
 * Neo Urbe: the cyberpunk art direction.
 *
 * Colours live in this table. The renderer never hardcodes a hue. `style: 'cyber'` selects the
 * armoured zone, civic and utility silhouettes; the classic shapes stay on the Urbe theme.
 * Tokens without a cyberpunk override are graded from Urbe so planes and boats stay in the
 * same family. The marina silhouette itself is chosen by `style: 'cyber'`.
 */

/** Recolour a value towards `target` by `amount` (0..1). */
const towards = (value: number, target: number, amount: number): number =>
  mix(value, target, Math.max(0, Math.min(1, amount)));

/** Cold, saturated neon grade applied to a whole palette. */
const grade = (value: number): number => {
  const cool = towards(value, 0x0a1020, 0.35);
  const lifted = shade(cool, 1.05);
  return mix(lifted, 0x2de2e6, 0.08);
};

const NEON_OVERRIDES: Record<string, number> = {
  // Ground reads as wet asphalt and concrete under sodium light.
  'ground.skirt': 0x0b1220,
  'ground.waterEdge': 0x123a52,
  'ground.outline': 0x04060c,
  'ground.undergroundWater': 0x0d2233,
  'ground.undergroundLand': 0x181a22,
  'ground.bareLot': 0x2a2f3a,

  // Smoke and fire keep their warmth: they are the only natural light in the scene.
  'fx.flameOuter': 0xff6a1f,
  'fx.flameInner': 0xffd24a,

  // Roads: black asphalt, cyan markings, magenta light strips.
  'road.surface': 0x14161d,
  'road.edge': 0x242a36,
  'road.mark': 0x2de2e6,
  'road.bridge': 0x1a1d26,
  'road.bridgePier': 0x0c0e14,
  'road.bridgeRail': 0xff3ea5,
  'road.bridgeSide': 0x22262f,
  'road.bridgeShadow': 0x05070d,
  'road.bridgeMark': 0x9b7bff,

  // Infrastructure glows.
  'infra.pipe': 0x1fd6ff,
  'infra.pipeDry': 0x39414f,
  'infra.canal': 0xff4ad8,
  'infra.canalDark': 0x5a2458,
  // Sheath of a power conduit. The lit core is `infra.pipe`, drawn on top.
  'infra.wire': 0x143848,
  'infra.wireCut': 0xff2d55,
  'infra.rubble': 0x2c2b33,
  'infra.flood': 0x1c6fa8,

  // Overlays stay legible on dark ground.
  'overlay.powerOn': 0xffd21f,
  'overlay.waterOn': 0x2de2e6,
  'overlay.dataOn': 0xd946ef,
  'overlay.unserved': 0xff2d55,
  'overlay.heatLow': 0x22e6a0,
  'overlay.heatMid': 0xffd21f,
  'overlay.heatHigh': 0xff2d55,
  'overlay.goodLow': 0xff2d55,
  'overlay.goodMid': 0xffd21f,
  'overlay.goodHigh': 0x2de2e6,

  // Selection.
  'highlight.okFill': 0x22e6a0,
  'highlight.okStroke': 0x8affd8,
  'highlight.badFill': 0xff2d55,
  'highlight.badStroke': 0xff9ab4,
  'highlight.neutralFill': 0x8a93a6,
  'highlight.neutralStroke': 0xf2f6ff,
  'highlight.hover': 0xffffff,

  // Trees: the only green left is bioluminescent.
  'tree.trunk': 0x241a26,
  'tree.leafDark': 0x0b3a3a,
  'tree.leafMid': 0x0f6a62,
  'tree.leafLight': 0x22b39a,

  // Vehicles.
  'vehicle.truckBody': 0x3a4150,
  'vehicle.fireBody': 0xff2d55,
  'vehicle.fireLadder': 0xd8dbe4,
  'vehicle.fireLightOn': 0xff2d55,
  'vehicle.fireLightOff': 0x2de2e6,
  'vehicle.fireLightDark': 0x3a1020,
  'vehicle.fireLightGlow': 0xff2d55,

  // Aircraft and airport.
  'plane.body': 0x2a3140,
  'plane.wing': 0x1e2430,
  'plane.engine': 0x161b24,
  'plane.cockpit': 0x2de2e6,
  'plane.accent': 0xff3ea5,
  'airport.asphalt': 0x10131a,
  'airport.taxiway': 0x1c202a,
  'airport.apron': 0x222833,
  'airport.paint': 0x2de2e6,
  'airport.yellow': 0xffd21f,
  'airport.light': 0xffd21f,
  'airport.grass': 0x142a26,
  'airport.terminalWall': 0x242b38,
  'airport.terminalRoof': 0x161b24,
  'airport.terminalWindow': 0x2de2e6,
  'airport.towerGlass': 0x2de2e6,
  'airport.mastLight': 0xff2d55,
  'airport.windsock': 0xff6a1f,

  // Marina wood reads as painted steel.
  'marina.wood': 0x24303c,
  'marina.woodEdge': 0x141a22,
  'marina.pierWood': 0x2a3644,
  'marina.pierSide': 0x141a22,
  'marina.clubRoof': 0x1d3a4a,
  'marina.clubWindow': 0x2de2e6,
  'marina.flagCloth': 0xff3ea5,

  // Power poles: steel mast and bus, not the graded timber of the classic post.
  'pole.post': 0x1a222c,
  'pole.arm': 0x8f96a8,
  'boat.deck': 0x2a3140,
  'boat.sail': 0x2de2e6,
  'boat.sailShade': 0x1a9fa6,
  'boat.wake': 0x9beef0,

  // Power grid: cold steel lit by electric arcs.
  'qanat.wall': 0x2a3040,
  'qanat.roof': 0x141922,
  'qanat.coil': 0x8f96a8,
  'qanat.arc': 0x2de2e6,
  'qanat.busbar': 0xffd21f,

  // Battery bank: black cells with a charge column.
  'cistern.wall': 0x1a1f2a,
  'cistern.roof': 0x0d1118,
  'cistern.cell': 0x232a38,
  'cistern.charge': 0x22e6a0,
  'cistern.strip': 0xffd21f,

  // Firewall: matte rack with magenta status LEDs.
  'windbreak.wall': 0x1c222c,
  'windbreak.roof': 0x0b0e15,
  'windbreak.rack': 0x101622,
  'windbreak.led': 0xff3ea5,
  'windbreak.dish': 0x2de2e6,

  // Drone port: lit deck, cyan pad ring, blinking beacons.
  'arcade.deck': 0x161c26,
  'arcade.deckEdge': 0x2de2e6,
  'arcade.pad': 0x0e1a22,
  'arcade.padRing': 0x2de2e6,
  'arcade.beacon': 0xff3ea5,
  'arcade.tower': 0x232a36,
  'arcade.towerLamp': 0x22e6a0,
  'arcade.droneBody': 0x2b3340,
  'arcade.droneTrim': 0x0c1018,
  'arcade.droneGlow': 0x2de2e6,

  // Corporate HQ: glass slab, magenta crown sign, gold beacon.
  'caravanserai.wall': 0x1b2330,
  'caravanserai.roof': 0x0a0e16,
  'caravanserai.window': 0x2de2e6,
  'caravanserai.trim': 0xff3ea5,
  'caravanserai.sign': 0xffd21f,
  'caravanserai.signGlow': 0xff3ea5,
  'caravanserai.spire': 0x6f7788,
  'caravanserai.beacon': 0xff2d55,

  // Civic services: dark concrete shells lit by neon, the way the drone port and the substation
  // read. Each building keeps a colour cue (magenta police, amber fire, cyan school, green
  // hospital) so the player tells them apart at a glance.
  'hospital.wall': 0x1d2632,
  'hospital.roof': 0x0b1018,
  'hospital.window': 0x2de2e6,
  'hospital.cross': 0x22e6a0,
  'hospital.padMark': 0x8affd8,
  'hospital.glow': 0x22e6a0,
  'police.wall': 0x232a38,
  'police.roof': 0x0d1119,
  'police.window': 0x2de2e6,
  'police.star': 0xff3ea5,
  'police.glow': 0xff3ea5,
  'police.beacon': 0xff2d55,
  'fire.wall': 0x2a1f26,
  'fire.roof': 0x120d12,
  'fire.window': 0xffd21f,
  'fire.door': 0xff2d55,
  'fire.glow': 0xffd21f,
  'fire.ladder': 0xff6a3a,
  'school.wall': 0x1b2430,
  'school.roof': 0x0c1018,
  'school.window': 0x2de2e6,
  'school.pole': 0x5a6474,
  'school.flag': 0xff3ea5,
  'school.glow': 0x9b7bff,
  'school.banner': 0xff3ea5,

  // Power and water: the same cold steel as the substation, with hotter emissive accents.
  'coal.wall': 0x222a36,
  'coal.roof': 0x0e1219,
  'coal.window': 0xffb060,
  'coal.stack': 0x3a4250,
  'coal.silo': 0x1a2029,
  'coal.glow': 0xff6a1f,
  'gas.wall': 0x1e2632,
  'gas.roof': 0x0c1018,
  'gas.window': 0x9fd8ff,
  'gas.tankBody': 0x2a3240,
  'gas.tankTop': 0x3c4757,
  'gas.tankRim': 0x6f7788,
  'gas.glow': 0x2de2e6,
  'gas.flare': 0xff6a1f,
  'pump.wall': 0x1c2430,
  'pump.roof': 0x0b0f16,
  'pump.window': 0x2de2e6,
  'pump.tank': 0x28303e,
  'pump.tankTop': 0x39445a,
  'pump.glow': 0x2de2e6,
  'pump.frame': 0x5a6474,
  'well.wall': 0x1a212c,
  'well.roof': 0x0b0f16,
  'well.window': 0x2de2e6,
  'well.pipe': 0x39445a,
  'well.pipeTop': 0x6f7788,
  'well.base': 0x2a3240,
  'well.glow': 0x2de2e6,
  'wind.tower': 0x2a3240,
  'wind.blade': 0xe6f7ff,
  'wind.hub': 0x2de2e6,
  'wind.glow': 0x22e6a0,
};

const colors: Record<string, number> = {};
for (const [token, value] of Object.entries(urbe.colors)) {
  colors[token] = NEON_OVERRIDES[token] ?? grade(value);
}

/** Cyberpunk take on the lot palettes: dark bodies, neon signage, lit windows. */
const neonLot = (wall: number, roof: number, window: number | undefined, accent: number) => ({
  wall: mix(grade(wall), 0x1b2130, 0.55),
  roof: mix(grade(roof), 0x0c101a, 0.45),
  ...(window === undefined ? {} : { window: mix(window, 0x2de2e6, 0.65) }),
  accent: mix(accent, 0xff3ea5, 0.6),
});

export const neon: Theme = {
  id: 'neon',
  style: 'cyber',
  background: 0x05070d,

  terrain: [0x0d3550, 0x1b2230, 0x14332c, 0x2a2a30, 0x202430],
  zone: [0x000000, 0x22e6a0, 0x2de2e6, 0xffd21f],
  lot: [0, 0x0f2a24, 0x14242e, 0x26241c],

  housePalettes: urbe.housePalettes.map((p) => neonLot(p.wall, p.roof, p.window, p.accent)),
  towerPalettes: urbe.towerPalettes.map((p) => neonLot(p.wall, p.roof, p.window, p.accent)),
  commercialPalettes: urbe.commercialPalettes.map((p) =>
    neonLot(p.wall, p.roof, p.window, p.accent),
  ),
  industrialPalettes: urbe.industrialPalettes.map((p) =>
    neonLot(p.wall, p.roof, p.window, p.accent),
  ),
  abandoned: neonLot(
    urbe.abandoned.wall,
    urbe.abandoned.roof,
    urbe.abandoned.window,
    urbe.abandoned.accent,
  ),

  boats: urbe.boats.map((c) => mix(grade(c), 0x2de2e6, 0.3)),
  cars: [0xff2d55, 0x2de2e6, 0xffd21f, 0xf2f6ff, 0x9b7bff, 0x3a4150],

  colors,
};

/** CSS custom properties for the Neo UI shell. */
export const neonCss: Record<string, string> = {
  '--bg': '#05070d',
  '--panel': '#0b1220',
  '--panel-edge': '#1b2a3a',
  '--ink': '#e6f7ff',
  '--ink-dim': '#8ea3b8',
  '--cyan': '#2de2e6',
  '--magenta': '#ff3ea5',
  '--amber': '#ffd21f',
  '--green': '#22e6a0',
  '--danger': '#ff2d55',
  '--violet': '#9b7bff',
};

/** Audio theme hooks: tempo and waveform choices for the synthwave composer. */
export const neonAudio = {
  bpm: 104,
  /** Scale degrees in a natural minor, as semitone offsets from the root. */
  scale: [0, 2, 3, 5, 7, 8, 10, 12],
  /** Detune of the pad voice, in cents. */
  padDetune: 11,
  /** Bass waveform. */
  bassWave: 'sawtooth' as const,
  /** Lead waveform. */
  leadWave: 'square' as const,
} as const;
