import { describe, expect, it } from 'vitest';
import { TAP_SLOP, TouchGestures } from '../../packages/view-iso/src/gestures';

describe('touch gestures', () => {
  it('a short touch is a tap at the starting point', () => {
    const g = new TouchGestures(() => false);
    expect(g.down(1, 100, 100)).toEqual([]);
    expect(g.move(1, 104, 103)).toEqual([]);
    expect(g.up(1, 104, 103)).toEqual([{ type: 'tap', x: 100, y: 100 }]);
    expect(g.active).toBe(false);
  });

  it('one finger past the slop pans the map, and never taps', () => {
    const g = new TouchGestures(() => false);
    g.down(1, 100, 100);
    expect(g.move(1, 100 + TAP_SLOP, 100)).toEqual([{ type: 'pan', dx: TAP_SLOP, dy: 0 }]);
    expect(g.move(1, 130, 90)).toEqual([{ type: 'pan', dx: 20, dy: -10 }]);
    expect(g.up(1, 130, 90)).toEqual([]);
  });

  it('with a drawing tool one finger draws from where it landed', () => {
    const g = new TouchGestures(() => true);
    g.down(1, 50, 50);
    expect(g.move(1, 70, 50)).toEqual([
      { type: 'drawStart', x: 50, y: 50 },
      { type: 'draw', x: 70, y: 50 },
    ]);
    expect(g.move(1, 90, 60)).toEqual([{ type: 'draw', x: 90, y: 60 }]);
    expect(g.up(1, 92, 60)).toEqual([{ type: 'drawEnd', x: 92, y: 60 }]);
  });

  it('a second finger cancels the drawing and pinches around the midpoint', () => {
    const g = new TouchGestures(() => true);
    g.down(1, 100, 100);
    g.move(1, 120, 100);
    expect(g.down(2, 220, 100)).toEqual([{ type: 'cancel' }]);
    // Spreading the second finger doubles the span and moves the midpoint right by 50.
    expect(g.move(2, 320, 100)).toEqual([
      { type: 'pan', dx: 50, dy: 0 },
      { type: 'zoom', factor: 2, x: 220, y: 100 },
    ]);
    // Lifting one finger leaves a pan; the last lift places nothing.
    expect(g.up(2, 320, 100)).toEqual([]);
    expect(g.move(1, 130, 110)).toEqual([{ type: 'pan', dx: 10, dy: 10 }]);
    expect(g.up(1, 130, 110)).toEqual([]);
  });

  it('two fingers that only slide together pan without zooming', () => {
    const g = new TouchGestures(() => false);
    g.down(1, 0, 0);
    g.down(2, 100, 0);
    expect(g.move(1, 0, 40)).toEqual([
      { type: 'pan', dx: 0, dy: 20 },
      { type: 'zoom', factor: Math.hypot(100, 40) / 100, x: 50, y: 20 },
    ]);
    expect(g.move(2, 100, 40)).toEqual([
      { type: 'pan', dx: 0, dy: 20 },
      { type: 'zoom', factor: 100 / Math.hypot(100, 40), x: 50, y: 40 },
    ]);
    g.up(1, 0, 40);
    expect(g.up(2, 100, 40)).toEqual([]);
  });

  it('a browser cancel drops the drawing and ignores unknown fingers', () => {
    const g = new TouchGestures(() => true);
    expect(g.up(9, 0, 0)).toEqual([]);
    g.down(1, 0, 0);
    g.move(1, 40, 0);
    expect(g.cancel(1)).toEqual([{ type: 'cancel' }]);
    expect(g.active).toBe(false);
    expect(g.move(1, 50, 0)).toEqual([]);
  });

  it('a pinch that loses a finger to the browser keeps panning with the other', () => {
    const g = new TouchGestures(() => false);
    g.down(1, 0, 0);
    g.down(2, 100, 0);
    expect(g.cancel(2)).toEqual([]);
    expect(g.move(1, 5, 5)).toEqual([{ type: 'pan', dx: 5, dy: 5 }]);
  });
});
