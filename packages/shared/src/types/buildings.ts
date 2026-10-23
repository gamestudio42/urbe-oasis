export const ZONE_BUILDING_KINDS = ['residential', 'commercial', 'industrial'] as const;
export type ZoneBuildingKind = (typeof ZONE_BUILDING_KINDS)[number];

export const PLACEABLE_KINDS = [
  'coalPlant',
  'gasPlant',
  'windTurbine',
  'waterPump',
  'well',
  'policeStation',
  'fireStation',
  'school',
  'hospital',
  'park',
  'marina',
  'airport',
  // Neon-only placeables. A classic city never contains them; both rulesets can load them.
  'qanat',
  'cistern',
  'windbreak',
  'arcade',
  'caravanserai',
  'springHouse',
  'palm',
] as const;
export type PlaceableKind = (typeof PLACEABLE_KINDS)[number];

/** Placeables that only the `neon` ruleset offers. */
export const OASIS_PLACEABLE_KINDS = [
  'qanat',
  'cistern',
  'windbreak',
  'arcade',
  'caravanserai',
  'springHouse',
  'palm',
] as const;
export type OasisPlaceableKind = (typeof OASIS_PLACEABLE_KINDS)[number];

export function isOasisPlaceable(kind: BuildingKind): kind is OasisPlaceableKind {
  return (OASIS_PLACEABLE_KINDS as readonly string[]).includes(kind);
}

export type BuildingKind = ZoneBuildingKind | PlaceableKind;

export type ServiceKind = 'policeStation' | 'fireStation' | 'school' | 'hospital';
export type PowerPlantKind = 'coalPlant' | 'gasPlant' | 'windTurbine';

/** Plain, serializable building state shared by the engine, the save file and the UI. */
export interface BuildingRecord {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
  capacity: number;
  occupancy: number;
  condition: number;
  age: number;
  abandoned: boolean;
  emptyMonths: number;
  variant: number;
  powered: boolean;
  watered: boolean;
  /**
   * On the neon data network. Absent in a classic city so the serialized building does not
   * gain a key the classic hash has never contained.
   */
  linked?: boolean;
  /** Ticks remaining while a plant is offline (blackout event). */
  offline: number;
  /** Last computed attractiveness 0..1, for diagnostics. */
  attractiveness: number;
  /** Megacorporation that owns a neon lot, or absent for city-owned buildings. */
  owner?: number;
}

export function isZoneKind(kind: BuildingKind): kind is ZoneBuildingKind {
  return kind === 'residential' || kind === 'commercial' || kind === 'industrial';
}
