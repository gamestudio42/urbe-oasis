import type { Point } from './iso';

/** Screen distance a finger may wander before a touch stops being a tap. */
export const TAP_SLOP = 10;

/** What a touch sequence means for the map, in screen pixels. */
export type GestureAction =
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'zoom'; factor: number; x: number; y: number }
  | { type: 'tap'; x: number; y: number }
  | { type: 'drawStart'; x: number; y: number }
  | { type: 'draw'; x: number; y: number }
  | { type: 'drawEnd'; x: number; y: number }
  | { type: 'cancel' };

type Mode = 'pending' | 'pan' | 'draw' | 'pinch' | 'done';

/**
 * Touch gestures for the map. One finger taps, pans, or draws when `draws()` says the active
 * tool paints an area or a line. A second finger always pans and pinches, and cancels a drawing
 * in progress. Once two fingers touched, the sequence stays a camera gesture until every finger
 * lifts, so lifting one finger never places anything.
 */
export class TouchGestures {
  private readonly touches = new Map<number, Point>();
  private mode: Mode = 'done';
  private start: Point = { x: 0, y: 0 };

  constructor(private readonly draws: () => boolean) {}

  get active(): boolean {
    return this.touches.size > 0;
  }

  down(id: number, x: number, y: number): GestureAction[] {
    this.touches.set(id, { x, y });
    if (this.touches.size === 1) {
      this.mode = 'pending';
      this.start = { x, y };
      return [];
    }
    const actions: GestureAction[] = this.mode === 'draw' ? [{ type: 'cancel' }] : [];
    this.mode = 'pinch';
    return actions;
  }

  move(id: number, x: number, y: number): GestureAction[] {
    const previous = this.touches.get(id);
    if (!previous) return [];
    if (this.mode === 'pinch') {
      const before = this.pair();
      this.touches.set(id, { x, y });
      const after = this.pair();
      if (!before || !after) return [];
      const actions: GestureAction[] = [
        { type: 'pan', dx: after.mid.x - before.mid.x, dy: after.mid.y - before.mid.y },
      ];
      if (before.span > 0 && after.span > 0 && after.span !== before.span)
        actions.push({ type: 'zoom', factor: after.span / before.span, ...after.mid });
      return actions;
    }
    this.touches.set(id, { x, y });
    if (this.mode === 'pending') {
      if (Math.hypot(x - this.start.x, y - this.start.y) < TAP_SLOP) return [];
      if (this.draws()) {
        this.mode = 'draw';
        return [
          { type: 'drawStart', ...this.start },
          { type: 'draw', x, y },
        ];
      }
      this.mode = 'pan';
      return [{ type: 'pan', dx: x - this.start.x, dy: y - this.start.y }];
    }
    if (this.mode === 'pan') return [{ type: 'pan', dx: x - previous.x, dy: y - previous.y }];
    if (this.mode === 'draw') return [{ type: 'draw', x, y }];
    return [];
  }

  up(id: number, x: number, y: number): GestureAction[] {
    if (!this.touches.delete(id)) return [];
    const mode = this.mode;
    if (this.touches.size > 0) {
      // The remaining finger keeps panning; it can no longer tap or draw.
      if (mode === 'pinch') this.mode = 'pan';
      return [];
    }
    this.mode = 'done';
    if (mode === 'pending') return [{ type: 'tap', ...this.start }];
    if (mode === 'draw') return [{ type: 'drawEnd', x, y }];
    return [];
  }

  /** The browser took the touch (scroll, system gesture): drop everything. */
  cancel(id: number): GestureAction[] {
    if (!this.touches.delete(id)) return [];
    const drawing = this.mode === 'draw';
    this.mode = this.touches.size === 0 ? 'done' : this.touches.size === 1 ? 'pan' : 'pinch';
    return drawing ? [{ type: 'cancel' }] : [];
  }

  private pair(): { mid: Point; span: number } | null {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return null;
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      span: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }
}
