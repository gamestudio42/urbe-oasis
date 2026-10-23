import type { BuildingKind, BuildingRecord } from '@city/shared';
import type { World } from './world';

export type NewBuilding = Omit<BuildingRecord, 'id'>;

/** Building records with stable insertion order, plus change tracking for deltas. */
export class BuildingStore {
  private readonly records = new Map<number, BuildingRecord>();
  nextId = 1;
  private readonly changed = new Set<number>();
  private readonly removed = new Set<number>();

  constructor(private readonly world: World) {}

  get size(): number {
    return this.records.size;
  }

  get(id: number): BuildingRecord | undefined {
    return this.records.get(id);
  }

  at(i: number): BuildingRecord | undefined {
    const id = this.world.buildingId[i] as number;
    return id === 0 ? undefined : this.records.get(id);
  }

  values(): IterableIterator<BuildingRecord> {
    return this.records.values();
  }

  /** Snapshot array, safe to iterate while adding or removing buildings. */
  list(): BuildingRecord[] {
    return [...this.records.values()];
  }

  ofKind(kind: BuildingKind): BuildingRecord[] {
    const out: BuildingRecord[] = [];
    for (const b of this.records.values()) if (b.kind === kind) out.push(b);
    return out;
  }

  add(spec: NewBuilding): BuildingRecord {
    const record: BuildingRecord = { ...spec, id: this.nextId++ };
    this.records.set(record.id, record);
    this.stamp(record, record.id);
    this.changed.add(record.id);
    return record;
  }

  /** Restores a record with its original id (used when loading saves). */
  restore(record: BuildingRecord): void {
    this.records.set(record.id, { ...record });
    this.stamp(record, record.id);
  }

  remove(id: number): BuildingRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    this.records.delete(id);
    this.stamp(record, 0);
    this.changed.delete(id);
    this.removed.add(id);
    return record;
  }

  touch(record: BuildingRecord): void {
    this.changed.add(record.id);
  }

  takeChanges(): { changed: BuildingRecord[]; removed: number[] } {
    const changed: BuildingRecord[] = [];
    for (const id of this.changed) {
      const record = this.records.get(id);
      if (record) changed.push({ ...record });
    }
    const removed = [...this.removed];
    this.changed.clear();
    this.removed.clear();
    return { changed, removed };
  }

  footprint(record: BuildingRecord): number[] {
    const tiles: number[] = [];
    for (let dy = 0; dy < record.h; dy++) {
      for (let dx = 0; dx < record.w; dx++)
        tiles.push(this.world.index(record.x + dx, record.y + dy));
    }
    return tiles;
  }

  private stamp(record: BuildingRecord, id: number): void {
    for (const i of this.footprint(record)) this.world.setBuildingId(i, id);
  }
}
