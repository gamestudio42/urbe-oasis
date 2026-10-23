import { Infra, Terrain } from '@city/shared';
import type { World } from '@city/simulation';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { TILE_H, TILE_W, overlayColor, type OverlayMode } from '@view/city';
import { shade, type Theme } from '@theme/core';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';

const REDRAW_MS = 400;
const ROAD = 0x55585e;
const BUILDING_SHADE = 0.72;
const FIRE = 0xff5020;

function rgb(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

/** Pixel colour of a tile on the minimap (map view or the active overlay). */
function tileColor(w: World, i: number, overlay: OverlayMode, theme: Theme): number {
  if (overlay !== 'none') {
    const c = overlayColor(w, i, overlay, theme);
    if (c !== null) return c;
  }
  const terrain = w.terrain[i] as number;
  let fill: number = theme.terrain[terrain] ?? (theme.terrain[Terrain.Grass] as number);
  const zone = w.zone[i] as number;
  if (zone !== 0) fill = theme.zone[zone] ?? fill;
  if ((w.trees[i] as number) > 0 && zone === 0) fill = shade(fill, 0.75);
  if (w.hasInfra(i, Infra.Road)) fill = ROAD;
  if ((w.buildingId[i] as number) !== 0) fill = shade(fill, BUILDING_SHADE);
  if ((w.fire[i] as number) > 0) fill = FIRE;
  return fill;
}

export function Minimap({ session }: { session: GameSession }) {
  const mapRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const overlay = useStore(session.ui, (s) => s.overlay);
  const ready = useStore(session.ui, (s) => s.ready);
  const theme = session.renderer.theme;

  // Terrain and city layer, redrawn at most every REDRAW_MS while the city changes.
  useEffect(() => {
    const canvas = mapRef.current;
    if (!canvas || !ready) return;
    let timer = 0;
    let pending = false;
    const draw = () => {
      timer = 0;
      pending = false;
      const w = session.client.world;
      const ctx = canvas.getContext('2d');
      if (!w || !ctx) return;
      const size = w.size;
      canvas.width = size * 2;
      canvas.height = size;
      const image = ctx.createImageData(size * 2, size);
      const data = image.data;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const [r, g, b] = rgb(tileColor(w, i, overlay, theme));
          // Isometric diamond: each tile covers two horizontal pixels.
          const px = x - y + size - 1;
          const py = (x + y) >> 1;
          for (let k = 0; k < 2; k++) {
            const o = (py * size * 2 + px + k) * 4;
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = b;
            data[o + 3] = 255;
          }
        }
      }
      ctx.putImageData(image, 0, 0);
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      timer = window.setTimeout(draw, REDRAW_MS);
    };
    draw();
    const unsubscribe = session.onTilesChanged(schedule);
    return () => {
      unsubscribe();
      if (timer) window.clearTimeout(timer);
    };
  }, [session, overlay, ready, theme]);

  // Camera rectangle, redrawn whenever the camera moves.
  useEffect(() => {
    const canvas = viewRef.current;
    if (!canvas || !ready) return;
    const draw = () => {
      const w = session.client.world;
      const ctx = canvas.getContext('2d');
      if (!w || !ctx) return;
      const size = w.size;
      canvas.width = size * 2;
      canvas.height = size;
      const r = session.renderer.visibleWorldRect();
      const sx = 2 / TILE_W;
      const sy = 1 / TILE_H;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x * sx + size, r.y * sy, r.width * sx, r.height * sy);
    };
    draw();
    const unsubscribe = session.onCamera(draw);
    window.addEventListener('resize', draw);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', draw);
    };
  }, [session, ready]);

  const moveTo = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const w = session.client.world;
    if (!w) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w.size * 2;
    const py = ((e.clientY - rect.top) / rect.height) * w.size;
    session.renderer.camera.centerOn(((px - w.size) * TILE_W) / 2, py * TILE_H);
    session.renderer.notifyCamera();
  };

  return (
    <div className="minimap" data-testid="minimap">
      <canvas ref={mapRef} className="minimap-map" />
      <canvas
        ref={viewRef}
        className="minimap-view"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) moveTo(e);
        }}
      />
    </div>
  );
}
