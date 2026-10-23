import {
  INFLUENCE_LAYERS,
  Infra,
  STRUCTURE_LAYERS,
  type InfluenceLayer,
  type StructureLayer,
  type Terrain,
  type Tile,
  type ZoneDensity,
  type ZoneType,
} from '@city/shared';

/**
 * Structure-of-arrays map. Tile index `i = y * size + x`; vertex index `v = vy * (size + 1) + vx`.
 * All mutations that the renderer must see go through `markDirty`.
 */
export class World {
  readonly size: number;
  readonly tileCount: number;
  readonly vertexSize: number;

  readonly heights: Uint8Array;
  readonly structure: Record<StructureLayer, Uint8Array>;
  readonly influence: Record<InfluenceLayer, Uint8Array>;
  readonly buildingId: Int32Array;
  /**
   * Neon data service, 0/1. Allocated for every city so the mirror can draw it, but omitted from
   * classic snapshots so the classic hash does not grow a layer.
   */
  readonly linked: Uint8Array;

  private readonly dirtyFlags: Uint8Array;
  private dirtyList: number[] = [];
  heightsDirty = false;
  influenceDirty = false;
  /** Incremented whenever a road bit changes; derived road data compares against it. */
  roadVersion = 0;
  /** Incremented when terrain changes after generation (derived terrain data compares it). */
  terrainVersion = 0;

  constructor(size: number) {
    this.size = size;
    this.tileCount = size * size;
    this.vertexSize = size + 1;
    this.heights = new Uint8Array(this.vertexSize * this.vertexSize);
    this.structure = Object.fromEntries(
      STRUCTURE_LAYERS.map((name) => [name, new Uint8Array(this.tileCount)]),
    ) as Record<StructureLayer, Uint8Array>;
    this.influence = Object.fromEntries(
      INFLUENCE_LAYERS.map((name) => [name, new Uint8Array(this.tileCount)]),
    ) as Record<InfluenceLayer, Uint8Array>;
    this.buildingId = new Int32Array(this.tileCount);
    this.linked = new Uint8Array(this.tileCount);
    this.dirtyFlags = new Uint8Array(this.tileCount);
  }

  get terrain(): Uint8Array {
    return this.structure.terrain;
  }
  get trees(): Uint8Array {
    return this.structure.trees;
  }
  get zone(): Uint8Array {
    return this.structure.zone;
  }
  get zoneDensity(): Uint8Array {
    return this.structure.zoneDensity;
  }
  get infra(): Uint8Array {
    return this.structure.infra;
  }
  get powered(): Uint8Array {
    return this.structure.powered;
  }
  get watered(): Uint8Array {
    return this.structure.watered;
  }
  get fire(): Uint8Array {
    return this.structure.fire;
  }
  get flood(): Uint8Array {
    return this.structure.flood;
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  xOf(i: number): number {
    return i % this.size;
  }

  yOf(i: number): number {
    return (i / this.size) | 0;
  }

  vertex(vx: number, vy: number): number {
    return vy * this.vertexSize + vx;
  }

  /** Corner heights of a tile: north, east, south, west. */
  corners(x: number, y: number): [number, number, number, number] {
    const vs = this.vertexSize;
    const h = this.heights;
    const n = y * vs + x;
    return [h[n] as number, h[n + 1] as number, h[n + vs + 1] as number, h[n + vs] as number];
  }

  minCorner(x: number, y: number): number {
    const [n, e, s, w] = this.corners(x, y);
    return Math.min(n, e, s, w);
  }

  maxCorner(x: number, y: number): number {
    const [n, e, s, w] = this.corners(x, y);
    return Math.max(n, e, s, w);
  }

  isFlat(x: number, y: number): boolean {
    const [n, e, s, w] = this.corners(x, y);
    return n === e && e === s && s === w;
  }

  /** Accepts flat tiles and simple slopes (max - min <= 1). */
  isGentle(x: number, y: number): boolean {
    return this.maxCorner(x, y) - this.minCorner(x, y) <= 1;
  }

  elevation(x: number, y: number): number {
    return this.minCorner(x, y);
  }

  hasInfra(i: number, flag: number): boolean {
    return ((this.structure.infra[i] as number) & flag) !== 0;
  }

  setInfra(i: number, flag: number, on: boolean): void {
    const infra = this.structure.infra;
    const before = infra[i] as number;
    const after = on ? before | flag : before & ~flag;
    if (after !== before) {
      infra[i] = after;
      if (((after ^ before) & Infra.Road) !== 0) this.roadVersion++;
      this.markDirty(i);
    }
  }

  setLayer(layer: StructureLayer, i: number, value: number): void {
    const data = this.structure[layer];
    if (data[i] !== value) {
      data[i] = value;
      this.markDirty(i);
      if (layer === 'terrain') this.terrainVersion++;
    }
  }

  setBuildingId(i: number, id: number): void {
    if (this.buildingId[i] !== id) {
      this.buildingId[i] = id;
      this.markDirty(i);
    }
  }

  isWater(i: number): boolean {
    return this.structure.terrain[i] === 0;
  }

  markDirty(i: number): void {
    if (this.dirtyFlags[i] === 0) {
      this.dirtyFlags[i] = 1;
      this.dirtyList.push(i);
    }
  }

  markAllDirty(): void {
    for (let i = 0; i < this.tileCount; i++) this.markDirty(i);
    this.heightsDirty = true;
    this.influenceDirty = true;
  }

  /** Returns and clears the list of dirty tiles. */
  takeDirty(): number[] {
    const list = this.dirtyList;
    for (const i of list) this.dirtyFlags[i] = 0;
    this.dirtyList = [];
    return list;
  }

  dirtyCount(): number {
    return this.dirtyList.length;
  }

  getTile(x: number, y: number): Tile {
    const i = this.index(x, y);
    const s = this.structure;
    const inf = this.influence;
    const infra = s.infra[i] as number;
    const id = this.buildingId[i] as number;
    const corners = this.corners(x, y);
    return {
      x,
      y,
      terrain: s.terrain[i] as Terrain,
      elevation: Math.min(...corners),
      flat: this.isFlat(x, y),
      corners,
      trees: s.trees[i] as number,
      zone: s.zone[i] as ZoneType,
      zoneDensity: s.zoneDensity[i] as ZoneDensity,
      buildingId: id === 0 ? null : id,
      road: (infra & Infra.Road) !== 0,
      powerLine: (infra & Infra.PowerLine) !== 0,
      waterPipe: (infra & Infra.Pipe) !== 0,
      canal: (infra & Infra.Canal) !== 0,
      rubble: (infra & Infra.Rubble) !== 0,
      powered: s.powered[i] === 1,
      watered: s.watered[i] === 1,
      linked: this.linked[i] === 1,
      fire: s.fire[i] as number,
      flood: s.flood[i] as number,
      pollution: inf.pollution[i] as number,
      crime: inf.crime[i] as number,
      landValue: inf.landValue[i] as number,
      traffic: inf.traffic[i] as number,
      access: inf.access[i] as number,
      police: inf.police[i] as number,
      fireCover: inf.fireCover[i] as number,
      health: inf.health[i] as number,
      education: inf.education[i] as number,
    };
  }
}
