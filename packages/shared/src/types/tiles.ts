export const Terrain = {
  Water: 0,
  Sand: 1,
  Grass: 2,
  Dirt: 3,
  Rock: 4,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export const ZoneType = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Industrial: 3,
} as const;
export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType];

export const ZoneDensity = {
  None: 0,
  Light: 1,
  Dense: 2,
} as const;
export type ZoneDensity = (typeof ZoneDensity)[keyof typeof ZoneDensity];

/** Bit flags stored in the `infra` layer. */
export const Infra = {
  Road: 1,
  PowerLine: 2,
  Pipe: 4,
  Rubble: 8,
  /** Neon data network. Stays unset in a classic city, so the infra bytes do not change. */
  Canal: 16,
} as const;
export type InfraFlag = (typeof Infra)[keyof typeof Infra];

/** Uint8 layers that describe the physical state of each tile and are synced per dirty tile. */
export const STRUCTURE_LAYERS = [
  'terrain',
  'trees',
  'zone',
  'zoneDensity',
  'infra',
  'powered',
  'watered',
  'fire',
  'flood',
] as const;
export type StructureLayer = (typeof STRUCTURE_LAYERS)[number];

/** Uint8 maps recomputed in bulk (monthly) and synced as whole arrays. */
export const INFLUENCE_LAYERS = [
  'pollution',
  'crime',
  'landValue',
  'traffic',
  'access',
  'police',
  'fireCover',
  'health',
  'education',
] as const;
export type InfluenceLayer = (typeof INFLUENCE_LAYERS)[number];

/** Read-only view of a tile, for tests and information panels. */
export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  elevation: number;
  flat: boolean;
  corners: [number, number, number, number];
  trees: number;
  zone: ZoneType;
  zoneDensity: ZoneDensity;
  buildingId: number | null;
  road: boolean;
  powerLine: boolean;
  waterPipe: boolean;
  /** Neon canal tile. False in a classic city. */
  canal: boolean;
  rubble: boolean;
  powered: boolean;
  watered: boolean;
  /** Neon data service. False in a classic city. */
  linked: boolean;
  fire: number;
  flood: number;
  pollution: number;
  crime: number;
  landValue: number;
  traffic: number;
  access: number;
  police: number;
  fireCover: number;
  health: number;
  education: number;
}
