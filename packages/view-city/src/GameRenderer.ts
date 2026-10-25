import {
  BALANCE,
  PLACEABLE_SPECS,
  type PlaceableKind,
  type BuildingRecord,
  type Speed,
} from '@city/shared';
import { tileVariant, type World } from '@city/simulation';
import { color, shade, type Theme } from '@theme/core';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import {
  AnimationLayer,
  type AnimationStats,
  type HubSample,
  type VehicleSample,
} from './animation/AnimationLayer';
import {
  Camera,
  CHUNK_SIZE,
  ChunkGrid,
  HEIGHT_STEP,
  intersects,
  isoChunkBounds,
  isTyping,
  pickTile,
  REDRAW_BUDGET,
  tileCenter,
  tileQuad,
  vertexToScreen,
  type ChunkArea,
  type Point,
} from '@shell/view-iso';
import {
  buildObjects,
  drawGround,
  drawOverlay,
  drawRoads,
  drawWires,
  waterSide,
  type DrawContext,
  type OverlayMode,
} from './chunkDraw';
import { prefersReducedMotion } from '@shell/chrome';
import { SpriteFactory } from './sprites';
import { drawSpringLandmark } from './oasisLandscape';
import { OasisEffects } from './OasisEffects';
import type { OasisMoment } from './oasisPresentation';

export { CHUNK_SIZE };
/** Menu background camera: zoom, seconds per loop and loop radius as a fraction of the map. */
const ATTRACT_ZOOM = 0.9;
const ATTRACT_PERIOD_S = 150;
const ATTRACT_RADIUS = 0.16;
/** Start of the loop, also the fixed view when the system asks for reduced motion. */
const ATTRACT_START = 0.6;

function layer<T extends Container>(container: T, label: string): T {
  container.label = label;
  return container;
}

interface Chunk {
  area: ChunkArea;
  root: Container;
  ground: Graphics;
  water: Container;
  /** Animated boats, under the road layer so they slip beneath a bridge deck. */
  boats: Container;
  roads: Graphics;
  overlay: Graphics;
  vehicles: Container;
  objects: Container;
  wires: Graphics;
  bounds: { x: number; y: number; width: number; height: number };
  dirty: boolean;
  overlayDirty: boolean;
  hasFire: boolean;
}

export interface HighlightTile {
  x: number;
  y: number;
  state: 'ok' | 'bad' | 'neutral';
}

/** Part of a network shown while planning or inspecting. Read-only; drawn under highlights. */
export interface ServiceTraceView {
  /** Conducting tile indices. */
  tiles: readonly number[];
  sources: readonly { x: number; y: number; w: number; h: number; ok: boolean }[];
}

/** Larger networks still show their sources; only the conductor outline is capped. */
const TRACE_TILE_LIMIT = 6000;

export interface RenderStats {
  chunks: number;
  visibleChunks: number;
  /** Every node under the world root, chunks and moving sprites included. */
  displayObjects: number;
  /** Generated sprite textures held by the factory cache. */
  textures: number;
}

export interface PlacementPreview {
  kind: PlaceableKind;
  x: number;
  y: number;
  ok: boolean;
}

function highlightColors(theme: Theme) {
  return {
    ok: { fill: color(theme, 'highlight.okFill'), stroke: color(theme, 'highlight.okStroke') },
    bad: { fill: color(theme, 'highlight.badFill'), stroke: color(theme, 'highlight.badStroke') },
    neutral: {
      fill: color(theme, 'highlight.neutralFill'),
      stroke: color(theme, 'highlight.neutralStroke'),
    },
  } as const;
}

export interface RendererInput {
  /** Called with tile coordinates (or null) on left-button events. */
  onPointer?(kind: 'down' | 'move' | 'up', tile: Point | null, event: PointerEvent): void;
  onHover?(tile: Point | null): void;
  onCancel?(): void;
  onCamera?(): void;
}

/** PixiJS isometric renderer for the mirror world. Never mutates simulation state. */
export class GameRenderer {
  readonly app = new Application();
  readonly camera = new Camera();
  readonly theme: Theme;
  private readonly root = new Container();
  private readonly chunkLayer = new Container();
  private readonly highlight = new Graphics();
  private readonly serviceTraceLayer = new Graphics();
  private serviceTrace: ServiceTraceView | null = null;
  private serviceTraceDirty = false;
  private readonly placementGhost = new Sprite();
  private placement: PlacementPreview | null = null;
  private readonly springMark = new Graphics();
  private springAt: { x: number; y: number } | null = null;
  private readonly chunkGrid = new ChunkGrid<Chunk>();
  private factory: SpriteFactory | null = null;
  private animation: AnimationLayer | null = null;
  private oasisEffects: OasisEffects | null = null;
  private reducedMotion = prefersReducedMotion();
  private animationsEnabled = true;
  private simSpeed: Speed = 1;
  private world: World | null = null;
  private buildings: Map<number, BuildingRecord> = new Map();
  private overlay: OverlayMode = 'none';
  private underground = false;
  private grid = false;
  private planning = false;
  private animationFrame = 0;
  private animationTimer = 0;
  private highlightTiles: HighlightTile[] = [];
  private hoverTile: Point | null = null;
  private highlightDirty = false;
  private input: RendererInput = {};
  private panning: { x: number; y: number } | null = null;
  private activePointer: number | null = null;
  private readonly listeners = new AbortController();
  private readonly keys = new Set<string>();
  /** Seconds into the menu camera loop, or null outside the menu. */
  private attract: { time: number; still: boolean } | null = null;
  private initialized = false;
  private destroyed = false;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: this.theme.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.classList.add('game-canvas');
    this.syncZoneDetail();
    this.factory = new SpriteFactory(this.app.renderer, this.theme);
    this.animation = new AnimationLayer(this.factory, this.theme);
    this.animation.setEnabled(this.animationsEnabled);
    this.animation.setSpeed(this.simSpeed);
    this.root.addChild(
      this.chunkLayer,
      this.animation.smoke,
      this.animation.sky,
      this.serviceTraceLayer,
      this.highlight,
      this.placementGhost,
      this.springMark,
    );
    this.app.stage.addChild(this.root);
    if (this.theme.style === 'adobe') {
      this.oasisEffects = new OasisEffects(this.theme);
      this.root.addChild(this.oasisEffects.markers);
      this.app.stage.addChild(this.oasisEffects.weather);
    }
    this.attachInput(this.app.canvas);
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener(
      'change',
      (event) => {
        this.reducedMotion = event.matches;
        if (event.matches) this.oasisEffects?.reset();
      },
      { signal: this.listeners.signal },
    );
    this.app.ticker.add(() => this.frame());
    this.app.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('city:contextlost'));
    });
    this.initialized = true;
    if (this.world) this.setWorld(this.world, this.buildings);
  }

  setInput(input: RendererInput): void {
    this.input = input;
  }

  /** Read-only renderer counts for quality checks: steady growth points to a leak. */
  renderStats(): RenderStats {
    let objects = 0;
    const count = (node: Container) => {
      objects++;
      for (const child of node.children) count(child as Container);
    };
    count(this.root);
    let visible = 0;
    for (const c of this.chunkGrid.chunks) if (c.root.visible) visible++;
    return {
      chunks: this.chunkGrid.chunks.length,
      visibleChunks: visible,
      displayObjects: objects,
      textures: this.factory?.cachedTextures ?? 0,
    };
  }

  get fps(): number {
    return this.app.ticker?.FPS ?? 0;
  }

  /** Simulation speed, so animations freeze while paused and hurry at 2× and 3×. */
  setSimSpeed(speed: Speed): void {
    this.simSpeed = speed;
    this.animation?.setSpeed(speed);
  }

  setAnimations(on: boolean): void {
    this.animationsEnabled = on;
    this.animation?.setEnabled(on);
  }

  animationStats(): AnimationStats {
    return (
      this.animation?.stats() ?? {
        cars: 0,
        trucks: 0,
        puffs: 0,
        sparkles: 0,
        boats: 0,
        planes: 0,
        drones: 0,
        walkers: 0,
        camels: 0,
      }
    );
  }

  vehicleSample(): VehicleSample[] {
    return this.animation?.sample() ?? [];
  }

  hubSample(): HubSample[] {
    return this.animation?.hubSample() ?? [];
  }

  /** Back-to-front labels of a map chunk. Tests lock boats under the road/bridge layer. */
  chunkStack(): string[] {
    const chunk = this.chunkGrid.chunks[0];
    return chunk ? chunk.root.children.map((child) => child.label) : [];
  }

  reportFire(x: number, y: number): void {
    this.animation?.reportFire(x, y);
  }

  reportOasisMoment(event: OasisMoment): void {
    if (this.animationsEnabled && !this.reducedMotion) this.oasisEffects?.state.report(event);
  }

  oasisEffectStats(): { signals: number; intensity: number; age: number } {
    const state = this.oasisEffects?.state;
    return {
      signals: state?.signals.length ?? 0,
      intensity: state?.intensity ?? 0,
      age: state?.stormAge ?? 0,
    };
  }

  /**
   * Menu background mode: keyboard panning is ignored and the camera drifts slowly around the
   * map centre (held still when the system asks for reduced motion).
   */
  setAttract(on: boolean): void {
    if (on === (this.attract !== null)) return;
    if (on) {
      this.setPlanning(false);
      this.attract = { time: 0, still: prefersReducedMotion() };
      this.keys.clear();
      this.panning = null;
      this.setHover(null);
    } else {
      this.attract = null;
      this.camera.zoom = 1;
    }
  }

  get attractMode(): boolean {
    return this.attract !== null;
  }

  setWorld(world: World, buildings: Map<number, BuildingRecord>): void {
    this.setPlacementPreview(null);
    this.setServiceTrace(null);
    this.oasisEffects?.reset();
    this.world = world;
    this.buildings = buildings;
    if (!this.initialized) return;
    for (const c of this.chunkGrid.chunks) c.root.destroy({ children: true });
    this.chunkLayer.removeChildren();
    const order = this.chunkGrid.rebuild(world.size, (area) => {
      const chunk: Chunk = {
        area,
        root: new Container(),
        ground: layer(new Graphics(), 'ground'),
        water: layer(new Container(), 'water'),
        boats: layer(new Container({ sortableChildren: true }), 'boats'),
        roads: layer(new Graphics(), 'roads'),
        overlay: layer(new Graphics(), 'overlay'),
        vehicles: layer(new Container({ sortableChildren: true }), 'vehicles'),
        objects: layer(new Container(), 'objects'),
        wires: layer(new Graphics(), 'wires'),
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        dirty: true,
        overlayDirty: true,
        hasFire: false,
      };
      // Boats on a span sit under roads; boats in open water sit with the cars,
      // so a hull in front of a bridge is not painted under the deck. Cars stay
      // under objects so a building in front of a street hides them.
      chunk.root.addChild(
        chunk.ground,
        chunk.water,
        chunk.boats,
        chunk.roads,
        chunk.overlay,
        chunk.vehicles,
        chunk.objects,
        chunk.wires,
      );
      return chunk;
    });
    for (const c of order) this.chunkLayer.addChild(c.root);
    for (const c of this.chunkGrid.chunks) this.computeBounds(c);
    this.animation?.setWorld(world, buildings, this.chunkGrid.chunks, (x, y) => this.chunkAt(x, y));
    this.drawSpring();

    const left = vertexToScreen(0, world.size, 0);
    const right = vertexToScreen(world.size, 0, 0);
    const bottom = vertexToScreen(world.size, world.size, 0);
    this.camera.bounds = {
      minX: left.x,
      maxX: right.x,
      minY: -BALANCE.map.maxHeight * HEIGHT_STEP,
      maxY: bottom.y,
    };
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    const centre = tileCenter(world, Math.floor(world.size / 2), Math.floor(world.size / 2));
    this.camera.zoom = 1;
    this.camera.centerOn(centre.x, centre.y);
    this.highlightDirty = true;
  }

  /** Marks chunks containing the given tiles for redraw (and their neighbours, for road joins). */
  invalidateTiles(indices: ArrayLike<number> | null): void {
    // A lot may be built over the landmark or the terrain beneath it may change height.
    this.drawSpring();
    if (!this.world) return;
    if (indices === null) {
      this.chunkGrid.invalidateTiles(null, this.world.size);
      for (const c of this.chunkGrid.chunks) this.computeBounds(c);
      return;
    }
    this.chunkGrid.invalidateTiles(indices, this.world.size, this.theme.style === 'adobe');
  }

  invalidateBuildings(changed: BuildingRecord[]): void {
    for (const b of changed) this.markChunkAt(b.x + b.w - 1, b.y + b.h - 1);
    this.animation?.buildingsChanged();
  }

  invalidateOverlay(): void {
    for (const c of this.chunkGrid.chunks) c.overlayDirty = true;
  }

  /** Gleam on the wandering spring. Hidden when the city has no oasis stats. */
  setSpring(at: { x: number; y: number } | null): void {
    if (at === null && this.springAt === null) return;
    if (at && this.springAt && at.x === this.springAt.x && at.y === this.springAt.y) return;
    this.springAt = at ? { x: at.x, y: at.y } : null;
    this.drawSpring();
  }

  private drawSpring(): void {
    const g = this.springMark;
    g.clear();
    if (!this.springAt || !this.world) {
      g.visible = false;
      return;
    }
    const p = tileCenter(this.world, this.springAt.x, this.springAt.y);
    const water = color(this.theme, 'overlay.waterOn');
    g.visible = true;
    g.position.set(p.x, p.y);
    if (this.theme.style === 'adobe') {
      const i = this.world.index(this.springAt.x, this.springAt.y);
      drawSpringLandmark(g, this.theme, this.world.buildingId[i] !== 0);
      return;
    }
    g.circle(0, -16, 8).fill({ color: water, alpha: 0.85 });
    g.circle(0, -16, 3).fill({ color: shade(water, 1.45), alpha: 0.95 });
  }

  setOverlay(mode: OverlayMode): void {
    if (mode === this.overlay) return;
    this.overlay = mode;
    this.syncZoneDetail();
    for (const c of this.chunkGrid.chunks) {
      c.overlayDirty = true;
      c.dirty = true;
    }
  }

  setUnderground(on: boolean): void {
    if (on === this.underground) return;
    this.underground = on;
    for (const c of this.chunkGrid.chunks) c.dirty = true;
  }

  setGrid(on: boolean): void {
    if (on === this.grid) return;
    this.grid = on;
    this.syncZoneDetail();
    for (const c of this.chunkGrid.chunks) c.dirty = true;
  }

  setPlanning(on: boolean): void {
    if (this.theme.style !== 'adobe' || on === this.planning) return;
    this.planning = on;
    this.syncZoneDetail();
    for (const c of this.chunkGrid.chunks) c.dirty = true;
  }

  private syncZoneDetail(): void {
    if (this.app.renderer)
      this.app.canvas.dataset.zoneDetail =
        this.theme.style !== 'adobe' || this.planning || this.grid || this.overlay !== 'none'
          ? 'full'
          : 'quiet';
  }

  setHighlight(tiles: HighlightTile[]): void {
    this.highlightTiles = tiles;
    this.highlightDirty = true;
  }

  /** Reuses the real building texture and anchor without adding a building to the mirror. */
  setPlacementPreview(placement: PlacementPreview | null): void {
    const world = this.world;
    const size = placement ? PLACEABLE_SPECS[placement.kind].size : 0;
    if (
      !placement ||
      !world ||
      !this.factory ||
      this.theme.style !== 'adobe' ||
      !world.inBounds(placement.x, placement.y) ||
      !world.inBounds(placement.x + size - 1, placement.y + size - 1)
    ) {
      this.placement = null;
      this.placementGhost.visible = false;
      return;
    }
    const { x, y, kind, ok } = placement;
    const building = {
      kind,
      x,
      y,
      w: size,
      h: size,
      level: 1,
      variant: tileVariant(x, y),
      abandoned: false,
    };
    const texture = this.factory.building(
      building,
      kind === 'marina' ? waterSide(world, building) : 0,
    );
    const front = vertexToScreen(x + size, y + size, world.corners(x + size - 1, y + size - 1)[2]);
    this.placementGhost.texture = texture.texture;
    this.placementGhost.anchor.set(texture.anchorX, texture.anchorY);
    this.placementGhost.position.set(front.x, front.y);
    this.placementGhost.alpha = ok ? 0.65 : 0.45;
    this.placementGhost.tint = color(this.theme, ok ? 'highlight.okStroke' : 'highlight.badStroke');
    this.placementGhost.visible = true;
    this.placement = { ...placement };
  }

  /** Outlines a network's conductors and rings its sources; never touches the mirror. */
  setServiceTrace(trace: ServiceTraceView | null): void {
    this.serviceTrace = trace;
    this.serviceTraceDirty = true;
  }

  /** Read-only copy of the drawn trace, used by browser checks. */
  serviceTraceState(): { tiles: number; sources: number; idle: number } | null {
    const trace = this.serviceTrace;
    if (!trace) return null;
    return {
      tiles: trace.tiles.length,
      sources: trace.sources.length,
      idle: trace.sources.filter((s) => !s.ok).length,
    };
  }

  /** Read-only inspection of the actual preview sprite, used by browser checks. */
  placementPreview(): (PlacementPreview & { visible: boolean }) | null {
    return this.placement ? { ...this.placement, visible: this.placementGhost.visible } : null;
  }

  /** Converts a client (CSS pixel) position to a tile. */
  pick(clientX: number, clientY: number): Point | null {
    if (!this.world) return null;
    const rect = this.app.canvas.getBoundingClientRect();
    const p = this.camera.screenToWorld(clientX - rect.left, clientY - rect.top);
    return pickTile(this.world, p.x, p.y, BALANCE.map.maxHeight);
  }

  /** Client (CSS pixel) position of a tile centre; used by E2E tests. */
  tileToClient(x: number, y: number): Point | null {
    if (!this.world) return null;
    const c = tileCenter(this.world, x, y);
    const s = this.camera.worldToScreen(c.x, c.y);
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: s.x + rect.left, y: s.y + rect.top };
  }

  centerOnTile(x: number, y: number): void {
    if (!this.world) return;
    const c = tileCenter(this.world, x, y);
    this.camera.centerOn(c.x, c.y);
    this.input.onCamera?.();
  }

  /** Sets the camera zoom, keeping the current centre. Used by tests and the inspector. */
  setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
    this.input.onCamera?.();
  }

  /** Tells listeners the camera moved after an external change (e.g. the minimap). */
  notifyCamera(): void {
    this.input.onCamera?.();
  }

  /** Map-space rectangle currently visible, in tile units, for the minimap. */
  visibleWorldRect(): { x: number; y: number; width: number; height: number } {
    return this.camera.visibleRect();
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.abort();
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private chunkAt(x: number, y: number): Chunk | null {
    if (!this.world) return null;
    return this.chunkGrid.chunkAt(x, y, this.world.size);
  }

  private markChunkAt(x: number, y: number): void {
    if (!this.world) return;
    this.chunkGrid.markAt(x, y, this.world.size);
  }

  private computeBounds(c: Chunk): void {
    c.bounds = isoChunkBounds(c.area, BALANCE.map.maxHeight);
  }

  private context(): DrawContext | null {
    if (!this.world) return null;
    return {
      world: this.world,
      buildings: this.buildings,
      underground: this.underground,
      grid: this.grid,
      planning: this.planning,
      overlay: this.overlay,
      animationFrame: this.animationFrame,
    };
  }

  private frame(): void {
    const ctx = this.context();
    if (!ctx || !this.factory) return;
    this.camera.viewWidth = this.app.screen.width;
    this.camera.viewHeight = this.app.screen.height;
    if (this.attract) this.driftCamera(this.attract, ctx.world);
    else this.applyKeyboardPan();
    this.camera.apply(this.root, this.attract === null);

    this.animationTimer += this.app.ticker.deltaMS;
    if (this.animationTimer > 250) {
      this.animationTimer = 0;
      this.animationFrame++;
      for (const c of this.chunkGrid.chunks) if (c.hasFire) c.dirty = true;
    }

    const view = this.camera.visibleRect();
    let budget = REDRAW_BUDGET;
    for (const c of this.chunkGrid.chunks) {
      const visible = intersects(view, c.bounds);
      c.root.visible = visible;
      if (!visible) continue;
      if (c.dirty && budget > 0) {
        budget--;
        this.redrawChunk(c, ctx);
      }
      if (c.overlayDirty) {
        c.overlay.clear();
        drawOverlay(c.overlay, this.theme, ctx, c.area);
        c.overlayDirty = false;
      }
    }
    this.animation?.update({
      deltaMS: this.app.ticker.deltaMS,
      view,
      zoom: this.camera.zoom,
      underground: this.underground,
      overlay: this.overlay !== 'none',
    });
    this.oasisEffects?.update({
      // elapsedMS avoids stretching a brief weather effect on a low-frame-rate device.
      deltaMS: this.app.ticker.elapsedMS,
      width: this.app.screen.width,
      height: this.app.screen.height,
      paused: this.simSpeed === 0,
      enabled: this.animationsEnabled && !this.reducedMotion,
      hidden: this.underground || this.overlay !== 'none' || this.attract !== null,
      project: (x, y) => tileCenter(ctx.world, x, y),
    });
    if (this.highlightDirty) this.drawHighlight();
    if (this.serviceTraceDirty) this.drawServiceTrace();
  }

  private redrawChunk(c: Chunk, ctx: DrawContext): void {
    c.ground.clear();
    drawGround(c.ground, this.theme, ctx, c.area);
    c.roads.clear();
    drawRoads(c.roads, this.theme, ctx, c.area);
    buildObjects(c.objects, ctx, this.factory as SpriteFactory, c.area);
    c.wires.clear();
    drawWires(c.wires, this.theme, ctx, c.area);
    this.animation?.rebuildWater(c);
    c.dirty = false;
    c.hasFire = false;
    const w = ctx.world;
    for (let y = c.area.y0; y < c.area.y1 && !c.hasFire; y++) {
      for (let x = c.area.x0; x < c.area.x1; x++) {
        if ((w.fire[w.index(x, y)] as number) > 0) {
          c.hasFire = true;
          break;
        }
      }
    }
  }

  private drawHighlight(): void {
    this.highlightDirty = false;
    const g = this.highlight;
    g.clear();
    const world = this.world;
    if (!world) return;
    for (const t of this.highlightTiles) {
      if (!world.inBounds(t.x, t.y)) continue;
      const q = tileQuad(world, t.x, t.y).flatMap((p) => [p.x, p.y]);
      const colors = highlightColors(this.theme)[t.state];
      g.poly(q).fill({ color: colors.fill, alpha: t.state === 'neutral' ? 0.2 : 0.35 });
      g.poly(q).stroke({ width: 1.5, color: colors.stroke, alpha: 0.9 });
    }
    if (this.hoverTile && world.inBounds(this.hoverTile.x, this.hoverTile.y)) {
      const q = tileQuad(world, this.hoverTile.x, this.hoverTile.y);
      g.poly(q.flatMap((p) => [p.x, p.y])).stroke({
        width: 2,
        color: color(this.theme, 'highlight.hover'),
        alpha: 0.95,
      });
    }
  }

  private drawServiceTrace(): void {
    this.serviceTraceDirty = false;
    const g = this.serviceTraceLayer;
    g.clear();
    const world = this.world;
    const trace = this.serviceTrace;
    if (!world || !trace) return;
    const neutral = color(this.theme, 'highlight.neutralStroke');
    const limit = Math.min(trace.tiles.length, TRACE_TILE_LIMIT);
    for (let k = 0; k < limit; k++) {
      const i = trace.tiles[k] as number;
      const q = tileQuad(world, world.xOf(i), world.yOf(i)).flatMap((p) => [p.x, p.y]);
      g.poly(q).fill({ color: neutral, alpha: 0.12 });
      g.poly(q).stroke({ width: 1, color: neutral, alpha: 0.55 });
    }
    for (const s of trace.sources) {
      const stroke = color(this.theme, s.ok ? 'highlight.okStroke' : 'highlight.badStroke');
      const fill = color(this.theme, s.ok ? 'highlight.okFill' : 'highlight.badFill');
      for (let y = s.y; y < s.y + s.h; y++) {
        for (let x = s.x; x < s.x + s.w; x++) {
          if (!world.inBounds(x, y)) continue;
          const q = tileQuad(world, x, y).flatMap((p) => [p.x, p.y]);
          g.poly(q).fill({ color: fill, alpha: 0.4 });
          g.poly(q).stroke({ width: 3, color: stroke, alpha: 0.95 });
        }
      }
    }
  }

  private setHover(tile: Point | null): void {
    const same =
      tile && this.hoverTile
        ? tile.x === this.hoverTile.x && tile.y === this.hoverTile.y
        : tile === this.hoverTile;
    if (same) return;
    this.hoverTile = tile;
    this.highlightDirty = true;
    this.input.onHover?.(tile);
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (this.activePointer !== null) return;
      this.activePointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 1 || e.button === 2 || (e.button === 0 && this.keys.has(' '))) {
        this.panning = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button === 0) this.input.onPointer?.('down', this.pick(e.clientX, e.clientY), e);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.activePointer !== null && e.pointerId !== this.activePointer) return;
      if (this.panning) {
        this.camera.pan(e.clientX - this.panning.x, e.clientY - this.panning.y);
        this.panning = { x: e.clientX, y: e.clientY };
        this.input.onCamera?.();
        return;
      }
      const tile = this.pick(e.clientX, e.clientY);
      this.setHover(tile);
      this.input.onPointer?.('move', tile, e);
    });
    const end = (e: PointerEvent) => {
      if (this.activePointer !== e.pointerId) return;
      this.activePointer = null;
      if (this.panning) {
        this.panning = null;
        return;
      }
      if (e.button === 0) {
        const tile = this.pick(e.clientX, e.clientY);
        this.setHover(tile);
        this.input.onPointer?.('up', tile, e);
      }
    };
    canvas.addEventListener('pointerup', end);
    const cancel = () => {
      this.activePointer = null;
      this.panning = null;
      this.input.onCancel?.();
    };
    for (const type of ['pointercancel', 'lostpointercapture'] as const) {
      canvas.addEventListener(type, (e) => {
        if (e.pointerId === this.activePointer) cancel();
      });
    }
    canvas.addEventListener('pointerleave', () => this.setHover(null));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.camera.zoomAt(
          e.deltaY < 0 ? 1.15 : 1 / 1.15,
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        this.input.onCamera?.();
      },
      { passive: false },
    );
    const signal = this.listeners.signal;
    window.addEventListener(
      'keydown',
      (e) => {
        if (isTyping(e) || e.ctrlKey || e.metaKey) return;
        this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      },
      { signal },
    );
    window.addEventListener(
      'keyup',
      (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
      {
        signal,
      },
    );
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        cancel();
      },
      { signal },
    );
  }

  private driftCamera(attract: { time: number; still: boolean }, world: World): void {
    if (!attract.still) attract.time += this.app.ticker.deltaMS / 1000;
    const angle = (ATTRACT_START + attract.time / ATTRACT_PERIOD_S) * Math.PI * 2;
    const half = world.size / 2;
    const radius = world.size * ATTRACT_RADIUS;
    const focus = vertexToScreen(
      half + radius * Math.cos(angle),
      half + radius * Math.sin(angle),
      0,
    );
    this.camera.zoom = ATTRACT_ZOOM;
    // Keep the focus right of centre so the menu card on the left does not cover it.
    const shift = this.camera.viewWidth > 900 ? (this.camera.viewWidth * 0.17) / ATTRACT_ZOOM : 0;
    this.camera.centerOn(focus.x - shift, focus.y);
  }

  private applyKeyboardPan(): void {
    if (this.keys.size === 0) return;
    const speed = (this.app.ticker.deltaMS / 1000) * 700;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) dy += speed;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) dy -= speed;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) dx += speed;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) dx -= speed;
    if (dx !== 0 || dy !== 0) {
      this.camera.pan(dx, dy);
      this.input.onCamera?.();
    }
  }
}
