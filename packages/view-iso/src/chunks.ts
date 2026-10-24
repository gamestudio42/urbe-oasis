import { HEIGHT_STEP, vertexToScreen } from './iso';

export const CHUNK_SIZE = 16;
export const REDRAW_BUDGET = 12;

export interface ChunkArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChunkRecord {
  area: ChunkArea;
  bounds: Rect;
  dirty: boolean;
  overlayDirty: boolean;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function isoChunkBounds(area: ChunkArea, maxHeight: number, heightStep = HEIGHT_STEP): Rect {
  const left = vertexToScreen(area.x0, area.y1, 0);
  const right = vertexToScreen(area.x1, area.y0, 0);
  const top = vertexToScreen(area.x0, area.y0, 0);
  const bottom = vertexToScreen(area.x1, area.y1, 0);
  const margin = maxHeight * heightStep + 160;
  return {
    x: left.x - 8,
    y: top.y - margin,
    width: right.x - left.x + 16,
    height: bottom.y - top.y + margin + 40,
  };
}

/** 16×16 chunk grid with dirty tracking and a per-frame redraw budget. */
export class ChunkGrid<T extends ChunkRecord> {
  chunks: T[] = [];
  sorted: T[] = [];
  chunksPerSide = 0;

  constructor(readonly chunkSize = CHUNK_SIZE) {}

  rebuild(mapSize: number, create: (area: ChunkArea) => T): T[] {
    this.chunks = [];
    this.chunksPerSide = Math.ceil(mapSize / this.chunkSize);
    const order: T[] = [];
    for (let cy = 0; cy < this.chunksPerSide; cy++) {
      for (let cx = 0; cx < this.chunksPerSide; cx++) {
        const area: ChunkArea = {
          x0: cx * this.chunkSize,
          y0: cy * this.chunkSize,
          x1: Math.min(mapSize, (cx + 1) * this.chunkSize),
          y1: Math.min(mapSize, (cy + 1) * this.chunkSize),
        };
        const chunk = create(area);
        this.chunks.push(chunk);
        order.push(chunk);
      }
    }
    order.sort((a, b) => a.area.x0 + a.area.y0 - (b.area.x0 + b.area.y0) || a.area.x0 - b.area.x0);
    this.sorted = order;
    return order;
  }

  chunkAt(x: number, y: number, mapSize: number): T | null {
    if (x < 0 || y < 0 || x >= mapSize || y >= mapSize) return null;
    return (
      this.chunks[Math.floor(y / this.chunkSize) * this.chunksPerSide + Math.floor(x / this.chunkSize)] ??
      null
    );
  }

  markAt(x: number, y: number, mapSize: number): void {
    const chunk = this.chunkAt(x, y, mapSize);
    if (chunk) {
      chunk.dirty = true;
      chunk.overlayDirty = true;
    }
  }

  /** Marks joined chunks; opt into corners when drawing also reads diagonal neighbours. */
  invalidateTiles(indices: ArrayLike<number> | null, mapSize: number, diagonals = false): void {
    if (indices === null) {
      for (const chunk of this.chunks) {
        chunk.dirty = true;
        chunk.overlayDirty = true;
      }
      return;
    }
    const size = this.chunkSize;
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k] as number;
      const x = i % mapSize;
      const y = (i / mapSize) | 0;
      this.markAt(x, y, mapSize);
      if (x % size === 0) this.markAt(x - 1, y, mapSize);
      if (x % size === size - 1) this.markAt(x + 1, y, mapSize);
      if (y % size === 0) this.markAt(x, y - 1, mapSize);
      if (y % size === size - 1) this.markAt(x, y + 1, mapSize);
      if (diagonals) {
        const dx = x % size === 0 ? -1 : x % size === size - 1 ? 1 : 0;
        const dy = y % size === 0 ? -1 : y % size === size - 1 ? 1 : 0;
        if (dx && dy) this.markAt(x + dx, y + dy, mapSize);
      }
    }
  }

  visitVisible(view: Rect, budget: number, visit: (chunk: T, visible: boolean) => boolean | void): void {
    let remaining = budget;
    for (const chunk of this.chunks) {
      const visible = intersects(view, chunk.bounds);
      const consume = visit(chunk, visible);
      if (visible && consume === true) remaining--;
      if (remaining <= 0 && consume === true) {
        // Keep walking so visibility flags stay up to date, but stop asking for redraws.
        remaining = 0;
      }
    }
  }
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}
