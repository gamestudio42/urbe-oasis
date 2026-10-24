import { Infra, PLACEABLE_SPECS, type BuildingRecord, type Speed } from '@city/shared';
import type { World } from '@city/simulation';
import type { Theme } from '@theme/core';
import { Container, Sprite } from 'pixi.js';
import { roadSurfaceLift } from '../bridge';
import { tileLocalToScreen, tileQuad, vertexToScreen } from '../iso';
import type { SpriteFactory } from '../sprites';
import { FireDispatch, type FireView, type StationFootprint } from './fireDispatch';
import { RUNWAY } from '../hubSprites';
import { DRONE_MIN_ZOOM, DroneTraffic, dronePose } from './drones';
import { HubTraffic, boatPose, flightState } from './hubs';
import { createRandom } from './random';
import { headingAt, lanePoint, worldRoadView, type RoadView } from './roads';
import { SmokeSim, puffLook, smokeVents } from './smoke';
import { VehicleSim, type Vehicle } from './vehicles';
import { CaravanSim, caravanRoute, type CaravanRoute } from './caravans';
import { SIDEWALK_OFFSET, WalkerSim, type StreetLife } from './walkers';
import { sparkleAlpha, sparkleSpots, type SparkleSpot } from './water';

/** Game-time multiplier per simulation speed: paused, 1×, 2×, 3×. */
export const SPEED_FACTORS = [0, 1, 1.6, 2.2] as const;
/** Cars are too small to read below this zoom. */
export const CAR_MIN_ZOOM = 0.45;
/** Pedestrians are too small to read below this zoom; camels read a little earlier. */
export const WALKER_MIN_ZOOM = 0.85;
export const CAMEL_MIN_ZOOM = 0.6;
/** People read beside the cars at street zoom. */
const WALKER_SCALE = 1.2;
/** Camels stand taller than people and read beside the cars. */
const CAMEL_SCALE = 1.25;
/** Lane of a caravan, just right of the road axis. */
const CAMEL_LANE = 0.1;
const OVERLAY_ALPHA = 0.45;
const POPULATE_INTERVAL = 0.25;
const VENT_REFRESH = 0.5;
const VENT_MARGIN = 80;
const LIGHT_HZ = 4;

/** The parts of a renderer chunk the animations draw into. */
export interface AnimatedChunk {
  readonly area: { x0: number; y0: number; x1: number; y1: number };
  readonly root: Container;
  readonly vehicles: Container;
  readonly water: Container;
  readonly boats: Container;
}

export interface AnimationFrame {
  deltaMS: number;
  view: { x: number; y: number; width: number; height: number };
  zoom: number;
  underground: boolean;
  overlay: boolean;
}

export interface AnimationStats {
  cars: number;
  trucks: number;
  puffs: number;
  sparkles: number;
  boats: number;
  planes: number;
  drones: number;
  walkers: number;
  camels: number;
}

/** Boats are too small to read below this zoom. */
const BOAT_MIN_ZOOM = 0.35;
const PLANE_SHADOW_ALPHA = 0.25;
/** Screen shift of a plane's shadow per pixel of altitude (light from the upper left). */
const SHADOW_SHIFT = { x: 0.35, y: 0.12 } as const;

export interface VehicleSample {
  id: number;
  kind: Vehicle['kind'];
  tile: number;
  x: number;
  y: number;
}

export interface HubSample {
  id: number;
  kind: 'boat' | 'plane' | 'drone' | 'camel';
  x: number;
  y: number;
  visible: boolean;
  tileX?: number;
  tileY?: number;
  /** The boat is on a water road tile and is drawn under the deck. */
  underSpan?: boolean;
}

interface VentPosition {
  key: number;
  x: number;
  y: number;
  strength: number;
}

interface WaterGlints {
  spots: SparkleSpot[];
  sprites: Sprite[];
}

/**
 * Cosmetic animation: cars, fire engines, chimney smoke, water glints, boats, planes and drones. Reads
 * the mirror world and never changes it; motion runs on game time, so it stops while paused.
 */
export class AnimationLayer {
  /** Smoke rises above every chunk; the renderer adds this container over the chunk layer. */
  readonly smoke = new Container();
  /** Planes and their shadows, above the smoke. */
  readonly sky = new Container();
  private world: World | null = null;
  private buildings: Map<number, BuildingRecord> = new Map();
  private chunks: readonly AnimatedChunk[] = [];
  private chunkAt: (x: number, y: number) => AnimatedChunk | null = () => null;
  private roads: RoadView | null = null;
  private fireView: FireView | null = null;
  private cars = new VehicleSim(createRandom(1));
  private trucks = new FireDispatch();
  private puffs = new SmokeSim(createRandom(2));
  private hubs: HubTraffic;
  private aerial: DroneTraffic;
  private walkers = new WalkerSim(createRandom(5));
  private caravans = new CaravanSim(createRandom(6));
  private streetLife: StreetLife | null = null;
  private vents: VentPosition[] = [];
  private stations: StationFootprint[] = [];
  private buildingsDirty = true;
  private sinceVents = VENT_REFRESH;
  private sincePopulate = POPULATE_INTERVAL;
  private time = 0;
  private enabled = true;
  private speed: Speed = 1;
  private readonly vehicleSprites = new Map<number, Sprite>();
  private readonly walkerSprites = new Map<number, Sprite>();
  private readonly camelSprites = new Map<string, Sprite>();
  private readonly puffSprites: Sprite[] = [];
  private readonly boatSprites = new Map<number, Sprite>();
  private readonly planeSprites = new Map<number, { plane: Sprite; shadow: Sprite }>();
  private readonly droneSprites = new Map<number, { drone: Sprite; shadow: Sprite }>();
  private readonly glints = new Map<AnimatedChunk, WaterGlints>();

  constructor(
    private readonly factory: SpriteFactory,
    private readonly theme: Theme,
  ) {
    this.hubs = new HubTraffic(createRandom(3), theme);
    this.aerial = new DroneTraffic(createRandom(4));
  }

  setWorld(
    world: World,
    buildings: Map<number, BuildingRecord>,
    chunks: readonly AnimatedChunk[],
    chunkAt: (x: number, y: number) => AnimatedChunk | null,
  ): void {
    this.world = world;
    this.buildings = buildings;
    this.chunks = chunks;
    this.chunkAt = chunkAt;
    this.roads = worldRoadView(world);
    this.fireView = {
      ...this.roads,
      fire: world.fire,
      fireCover: world.influence.fireCover,
    };
    // The previous chunks were destroyed with their children, including vehicle sprites.
    this.vehicleSprites.clear();
    this.walkerSprites.clear();
    this.camelSprites.clear();
    this.boatSprites.clear();
    this.clearPlanes();
    this.clearDrones();
    this.glints.clear();
    this.cars = new VehicleSim(createRandom(world.size * 7919 + 1));
    this.trucks = new FireDispatch();
    this.puffs = new SmokeSim(createRandom(world.size * 7919 + 2));
    this.hubs = new HubTraffic(createRandom(world.size * 7919 + 3), this.theme);
    this.aerial = new DroneTraffic(createRandom(world.size * 7919 + 4));
    this.walkers = new WalkerSim(createRandom(world.size * 7919 + 5));
    this.caravans = new CaravanSim(createRandom(world.size * 7919 + 6));
    this.streetLife = null;
    this.buildingsDirty = true;
    this.sinceVents = VENT_REFRESH;
    this.sincePopulate = POPULATE_INTERVAL;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.clearMoving();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Building records changed: chimneys and fire stations are recomputed soon. */
  buildingsChanged(): void {
    this.buildingsDirty = true;
  }

  /** A fire started at tile (x, y); a covered station sends a truck even if it is already out. */
  reportFire(x: number, y: number): void {
    const world = this.world;
    if (!this.enabled || !world || !world.inBounds(x, y)) return;
    this.trucks.report(world.index(x, y));
  }

  /** Recreates the water glints of a chunk after it was redrawn. */
  rebuildWater(chunk: AnimatedChunk): void {
    for (const child of chunk.water.removeChildren()) child.destroy();
    const world = this.world;
    if (!world) return;
    const spots = sparkleSpots(world, chunk.area);
    const tex = this.factory.sparkle();
    const sprites = spots.map((s) => {
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const p = tileLocalToScreen(tileQuad(world, s.x, s.y), s.u, s.v);
      sprite.position.set(p.x, p.y);
      sprite.visible = false;
      chunk.water.addChild(sprite);
      return sprite;
    });
    this.glints.set(chunk, { spots, sprites });
  }

  update(frame: AnimationFrame): void {
    const world = this.world;
    const roads = this.roads;
    const fireView = this.fireView;
    if (!world || !roads || !fireView) return;
    const realDt = Math.min(0.1, frame.deltaMS / 1000);
    this.time += realDt;
    const dt = realDt * SPEED_FACTORS[this.speed];
    this.animateWater(this.enabled && !frame.underground);
    if (!this.enabled) return;

    const showCars = !frame.underground && frame.zoom >= CAR_MIN_ZOOM;
    if (!showCars) {
      this.cars.clear();
    } else {
      const visible = (tile: number) => this.isTileVisible(tile);
      this.cars.step(roads, dt, visible);
      if (dt > 0) {
        this.sincePopulate += realDt;
        if (this.sincePopulate >= POPULATE_INTERVAL) {
          this.sincePopulate = 0;
          const tiles = this.visibleRoadTiles(roads);
          this.cars.populate(roads, tiles);
          if (this.streetLife && frame.zoom >= WALKER_MIN_ZOOM)
            this.walkers.populate(this.streetLife, tiles);
        }
      }
    }
    const life = this.streetLife;
    if (!life || frame.underground || frame.zoom < WALKER_MIN_ZOOM) this.walkers.clear();
    else this.walkers.step(life, dt, (tile) => this.isTileVisible(tile));
    if (life) this.caravans.step(dt);

    this.sinceVents += realDt;
    if (this.buildingsDirty && this.sinceVents >= VENT_REFRESH) this.refreshBuildings(world);
    this.trucks.step(fireView, this.stations, dt);
    this.puffs.step(frame.underground ? [] : this.ventsInView(frame.view), dt);
    this.hubs.step(dt);
    if (this.theme.style === 'cyber') {
      this.aerial.setPorts(world, this.buildings.values());
      this.aerial.step(dt);
    } else if (this.aerial.drones.length > 0) {
      this.aerial.clear();
    }

    const alpha = frame.overlay ? OVERLAY_ALPHA : 1;
    this.syncVehicles(world, !frame.underground, alpha);
    this.syncWalkers(world, !frame.underground, alpha);
    this.syncCamels(world, !frame.underground && frame.zoom >= CAMEL_MIN_ZOOM, alpha);
    this.syncPuffs(!frame.underground, alpha, frame.zoom);
    this.syncBoats(world, !frame.underground && frame.zoom >= BOAT_MIN_ZOOM, alpha);
    this.syncPlanes(world, !frame.underground, alpha);
    this.syncDrones(
      world,
      this.theme.style === 'cyber' && !frame.underground && frame.zoom >= DRONE_MIN_ZOOM,
      alpha,
    );
  }

  stats(): AnimationStats {
    let sparkles = 0;
    if (this.enabled) {
      for (const [chunk, g] of this.glints) {
        if (chunk.root.visible && chunk.water.visible) sparkles += g.spots.length;
      }
    }
    return {
      cars: this.cars.vehicles.length,
      trucks: this.trucks.trucks.length,
      puffs: this.puffs.puffs.length,
      sparkles,
      boats: this.hubs.boats.length,
      planes: this.hubs.planes.length,
      drones: this.aerial.drones.length,
      walkers: this.walkers.walkers.length,
      camels: this.caravans.poses().length,
    };
  }

  /** Screen positions of a few vehicles (tests check that they freeze while paused). */
  sample(count = 6): VehicleSample[] {
    const list: VehicleSample[] = [];
    for (const v of [...this.trucks.trucks, ...this.cars.vehicles].slice(0, count)) {
      const sprite = this.vehicleSprites.get(spriteKey(v));
      if (!sprite) continue;
      list.push({ id: v.id, kind: v.kind, tile: v.tile, x: sprite.x, y: sprite.y });
    }
    return list;
  }

  /** Screen positions of boats and planes (tests check that they move). */
  hubSample(): HubSample[] {
    const list: HubSample[] = [];
    const size = this.world?.size ?? 0;
    for (const boat of this.hubs.boats) {
      const sprite = this.boatSprites.get(boat.id);
      if (!sprite) continue;
      const pose = boatPose(boat, size);
      const tx = Math.min(size - 1, Math.max(0, Math.floor(pose.x)));
      const ty = Math.min(size - 1, Math.max(0, Math.floor(pose.y)));
      list.push({
        id: boat.id,
        kind: 'boat',
        x: sprite.x,
        y: sprite.y,
        visible: sprite.visible,
        tileX: pose.x,
        tileY: pose.y,
        underSpan: this.world ? underSpan(this.world, tx, ty) : false,
      });
    }
    for (const [id, s] of this.planeSprites) {
      list.push({ id, kind: 'plane', x: s.plane.x, y: s.plane.y, visible: s.plane.visible });
    }
    for (const camel of this.caravans.poses()) {
      const sprite = this.camelSprites.get(`${camel.caravan}:${camel.index}`);
      if (!sprite) continue;
      list.push({
        id: camel.caravan * 100 + camel.index,
        kind: 'camel',
        x: sprite.x,
        y: sprite.y,
        visible: sprite.visible,
        tileX: camel.tile % Math.max(1, size),
        tileY: Math.floor(camel.tile / Math.max(1, size)),
      });
    }
    for (const [id, s] of this.droneSprites) {
      list.push({ id, kind: 'drone', x: s.drone.x, y: s.drone.y, visible: s.drone.visible });
    }
    return list;
  }

  private clearMoving(): void {
    this.cars.clear();
    this.trucks.clear();
    this.puffs.clear();
    this.hubs.clear();
    this.aerial.clear();
    this.walkers.clear();
    this.caravans.clear();
    for (const sprite of this.vehicleSprites.values()) sprite.destroy();
    this.vehicleSprites.clear();
    for (const sprite of this.walkerSprites.values()) sprite.destroy();
    this.walkerSprites.clear();
    for (const sprite of this.camelSprites.values()) sprite.destroy();
    this.camelSprites.clear();
    for (const sprite of this.boatSprites.values()) sprite.destroy();
    this.boatSprites.clear();
    this.clearPlanes();
    this.clearDrones();
    for (const sprite of this.puffSprites) sprite.visible = false;
  }

  private clearPlanes(): void {
    for (const s of this.planeSprites.values()) {
      s.plane.destroy();
      s.shadow.destroy();
    }
    this.planeSprites.clear();
  }

  private clearDrones(): void {
    for (const s of this.droneSprites.values()) {
      s.drone.destroy();
      s.shadow.destroy();
    }
    this.droneSprites.clear();
  }

  private isTileVisible(tile: number): boolean {
    const size = this.world?.size ?? 0;
    return this.chunkAt(tile % size, Math.floor(tile / size))?.root.visible ?? false;
  }

  private visibleRoadTiles(roads: RoadView): number[] {
    const tiles: number[] = [];
    for (const chunk of this.chunks) {
      if (!chunk.root.visible) continue;
      const { x0, y0, x1, y1 } = chunk.area;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * roads.size + x;
          if (roads.hasRoad(i)) tiles.push(i);
        }
      }
    }
    return tiles;
  }

  private refreshBuildings(world: World): void {
    this.buildingsDirty = false;
    this.sinceVents = 0;
    this.vents = smokeVents(this.buildings.values(), this.theme).map((v) => {
      const front = vertexToScreen(
        v.frontX + 1,
        v.frontY + 1,
        world.corners(v.frontX, v.frontY)[2],
      );
      return { key: v.key, x: front.x + v.offsetX, y: front.y + v.offsetY, strength: v.strength };
    });
    this.stations = [];
    for (const b of this.buildings.values()) {
      if (b.kind === 'fireStation') this.stations.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    }
    this.hubs.setSites(world, this.buildings.values());
    if (this.theme.style === 'adobe' && this.roads) {
      this.streetLife = streetLife(world, this.roads, this.buildings);
      this.caravans.setRoutes(caravanRoutes(world, this.roads, this.buildings));
    } else {
      this.streetLife = null;
      this.caravans.setRoutes([]);
    }
  }

  private syncWalkers(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    for (const w of this.walkers.walkers) {
      live.add(w.id);
      const x = w.tile % world.size;
      const y = Math.floor(w.tile / world.size);
      const chunk = this.chunkAt(x, y);
      if (!chunk) continue;
      const frame = w.pause > 0 ? 0 : Math.floor(w.t * 6 + w.id) % 2;
      const tex = this.factory.walker(w.robe, frame);
      let sprite = this.walkerSprites.get(w.id);
      if (!sprite) {
        sprite = new Sprite(tex.texture);
        this.walkerSprites.set(w.id, sprite);
      } else sprite.texture = tex.texture;
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      if (sprite.parent !== chunk.vehicles) chunk.vehicles.addChild(sprite);
      const { u, v } = lanePoint(w.travelIn, w.travelOut, w.t, SIDEWALK_OFFSET * w.side);
      const p = tileLocalToScreen(tileQuad(world, x, y), u, v);
      sprite.position.set(p.x, p.y - roadSurfaceLift(world, x, y, u, v));
      sprite.scale.set(WALKER_SCALE);
      sprite.zIndex = x + u + y + v;
      sprite.alpha = alpha;
      sprite.visible = show;
    }
    for (const [id, sprite] of this.walkerSprites) {
      if (live.has(id)) continue;
      sprite.destroy();
      this.walkerSprites.delete(id);
    }
  }

  private syncCamels(world: World, show: boolean, alpha: number): void {
    const live = new Set<string>();
    for (const camel of this.caravans.poses()) {
      const key = `${camel.caravan}:${camel.index}`;
      live.add(key);
      const x = camel.tile % world.size;
      const y = Math.floor(camel.tile / world.size);
      const chunk = this.chunkAt(x, y);
      if (!chunk) continue;
      const frame = Math.floor(camel.t * 4 + camel.index) % 2;
      const tex = this.factory.camel(camel.index, frame);
      let sprite = this.camelSprites.get(key);
      if (!sprite) {
        sprite = new Sprite(tex.texture);
        this.camelSprites.set(key, sprite);
      } else sprite.texture = tex.texture;
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      if (sprite.parent !== chunk.vehicles) chunk.vehicles.addChild(sprite);
      const { u, v } = lanePoint(camel.travelIn, camel.travelOut, camel.t, CAMEL_LANE);
      const p = tileLocalToScreen(tileQuad(world, x, y), u, v);
      sprite.position.set(p.x, p.y - roadSurfaceLift(world, x, y, u, v));
      // North and east read as walking right on screen; south and west as walking left.
      const heading = headingAt(camel.travelIn, camel.travelOut, camel.t);
      sprite.scale.set((heading === 0 || heading === 1 ? 1 : -1) * CAMEL_SCALE, CAMEL_SCALE);
      sprite.zIndex = x + u + y + v;
      sprite.alpha = alpha * camel.alpha;
      sprite.visible = show && camel.alpha > 0;
    }
    for (const [key, sprite] of this.camelSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.camelSprites.delete(key);
    }
  }

  private ventsInView(view: AnimationFrame['view']): VentPosition[] {
    return this.vents.filter(
      (v) =>
        v.x > view.x - VENT_MARGIN &&
        v.x < view.x + view.width + VENT_MARGIN &&
        v.y > view.y - VENT_MARGIN &&
        v.y < view.y + view.height + VENT_MARGIN * 3,
    );
  }

  private syncVehicles(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    const blink = Math.floor(this.time * LIGHT_HZ) % 2 === 0;
    const place = (v: Vehicle, light: boolean) => {
      const key = spriteKey(v);
      live.add(key);
      const x = v.tile % world.size;
      const y = Math.floor(v.tile / world.size);
      const chunk = this.chunkAt(x, y);
      if (!chunk) return;
      const heading = headingAt(v.travelIn, v.travelOut, v.t);
      const tex = this.factory.vehicle(v.kind, heading % 2 === 1 ? 'x' : 'y', v.color, light);
      let sprite = this.vehicleSprites.get(key);
      if (!sprite) {
        sprite = new Sprite(tex.texture);
        this.vehicleSprites.set(key, sprite);
      } else {
        sprite.texture = tex.texture;
      }
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      if (sprite.parent !== chunk.vehicles) chunk.vehicles.addChild(sprite);
      const { u, v: lv } = lanePoint(v.travelIn, v.travelOut, v.t);
      const p = tileLocalToScreen(tileQuad(world, x, y), u, lv);
      sprite.position.set(p.x, p.y - roadSurfaceLift(world, x, y, u, lv));
      sprite.zIndex = x + u + y + lv;
      sprite.alpha = alpha;
      sprite.visible = show;
    };
    for (const v of this.cars.vehicles) place(v, false);
    for (const t of this.trucks.trucks) place(t, t.state !== 'returning' && blink);
    for (const [key, sprite] of this.vehicleSprites) {
      if (live.has(key)) continue;
      sprite.destroy();
      this.vehicleSprites.delete(key);
    }
  }

  private syncBoats(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    for (const boat of this.hubs.boats) {
      live.add(boat.id);
      const pose = boatPose(boat, world.size);
      const tx = Math.min(world.size - 1, Math.max(0, Math.floor(pose.x)));
      const ty = Math.min(world.size - 1, Math.max(0, Math.floor(pose.y)));
      const chunk = this.chunkAt(tx, ty);
      if (!chunk) continue;
      const moving = boat.pause <= 0;
      const tex = this.factory.boat(boat.kind, pose.heading, boat.color, moving);
      let sprite = this.boatSprites.get(boat.id);
      if (!sprite) {
        sprite = new Sprite(tex.texture);
        this.boatSprites.set(boat.id, sprite);
      } else {
        sprite.texture = tex.texture;
      }
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      // Only a hull on the span itself goes under the deck. In front of the
      // bridge the boat stays with the cars, above the roads.
      const layer = underSpan(world, tx, ty) ? chunk.boats : chunk.vehicles;
      if (sprite.parent !== layer) layer.addChild(sprite);
      const p = tileLocalToScreen(tileQuad(world, tx, ty), pose.x - tx, pose.y - ty);
      sprite.position.set(p.x, p.y);
      sprite.zIndex = pose.x + pose.y;
      sprite.alpha = alpha;
      sprite.visible = show;
    }
    for (const [id, sprite] of this.boatSprites) {
      if (live.has(id)) continue;
      sprite.destroy();
      this.boatSprites.delete(id);
    }
  }

  private syncPlanes(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    for (const plane of this.hubs.planes) {
      const site = this.hubs.site(plane.site);
      if (!site) continue;
      live.add(plane.id);
      const state = flightState(plane.mode, plane.time);
      const ground = vertexToScreen(
        site.x + state.u,
        site.y + RUNWAY.v,
        world.elevation(site.x, site.y),
      );
      let s = this.planeSprites.get(plane.id);
      if (!s) {
        const shadowTex = this.factory.planeShadow(0);
        const planeTex = this.factory.plane(0);
        s = { plane: new Sprite(planeTex.texture), shadow: new Sprite(shadowTex.texture) };
        s.shadow.anchor.set(shadowTex.anchorX, shadowTex.anchorY);
        s.plane.anchor.set(planeTex.anchorX, planeTex.anchorY);
        this.sky.addChild(s.shadow, s.plane);
        this.planeSprites.set(plane.id, s);
      }
      s.shadow.position.set(
        ground.x + state.altitude * SHADOW_SHIFT.x,
        ground.y + state.altitude * SHADOW_SHIFT.y,
      );
      s.shadow.alpha =
        PLANE_SHADOW_ALPHA * state.alpha * alpha * Math.max(0, 1 - state.altitude / 300);
      s.plane.position.set(ground.x, ground.y - state.altitude);
      s.plane.alpha = state.alpha * alpha;
      s.shadow.visible = show;
      s.plane.visible = show;
    }
    for (const [id, s] of this.planeSprites) {
      if (live.has(id)) continue;
      s.plane.destroy();
      s.shadow.destroy();
      this.planeSprites.delete(id);
    }
  }

  /**
   * Drones cruise `DRONE_ALTITUDE` pixels above the street along their lane, turning at the far
   * end and coming back. The shadow drifts with altitude, so the climb out and the landing read.
   */
  private syncDrones(world: World, show: boolean, alpha: number): void {
    const live = new Set<number>();
    for (const drone of this.aerial.drones) {
      const lane = this.aerial.laneOf(drone.portId, drone.heading);
      if (!lane) continue;
      live.add(drone.id);
      const pose = dronePose(drone, lane);
      const tx = Math.min(world.size - 1, Math.max(0, Math.floor(pose.x)));
      const ty = Math.min(world.size - 1, Math.max(0, Math.floor(pose.y)));
      const ground = vertexToScreen(pose.x, pose.y, world.elevation(tx, ty));
      let s = this.droneSprites.get(drone.id);
      if (!s) {
        const tex = this.factory.drone(0);
        const shadowTex = this.factory.droneShadow();
        s = { drone: new Sprite(tex.texture), shadow: new Sprite(shadowTex.texture) };
        s.shadow.anchor.set(shadowTex.anchorX, shadowTex.anchorY);
        s.drone.anchor.set(tex.anchorX, tex.anchorY);
        this.sky.addChild(s.shadow, s.drone);
        this.droneSprites.set(drone.id, s);
      }
      const lift = drone.altitude + pose.bob;
      s.shadow.position.set(ground.x + lift * SHADOW_SHIFT.x, ground.y + lift * SHADOW_SHIFT.y);
      s.shadow.alpha = PLANE_SHADOW_ALPHA * alpha * Math.max(0, 1 - lift / 120);
      s.drone.position.set(ground.x, ground.y - lift);
      s.drone.alpha = alpha;
      // Rotor flicker: four blade phases cycled on the animation clock.
      s.drone.texture = this.factory.drone(Math.floor(this.time * 18 + drone.id)).texture;
      s.shadow.visible = show;
      s.drone.visible = show;
    }
    for (const [id, s] of this.droneSprites) {
      if (live.has(id)) continue;
      s.drone.destroy();
      s.shadow.destroy();
      this.droneSprites.delete(id);
    }
  }

  private syncPuffs(show: boolean, alpha: number, zoom: number): void {
    const puffs = this.puffs.puffs;
    const tex = this.factory.smokePuff();
    while (this.puffSprites.length < puffs.length) {
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(0.5);
      this.smoke.addChild(sprite);
      this.puffSprites.push(sprite);
    }
    for (let k = 0; k < this.puffSprites.length; k++) {
      const sprite = this.puffSprites[k] as Sprite;
      const p = puffs[k];
      if (!p || !show) {
        sprite.visible = false;
        continue;
      }
      const look = puffLook(p, zoom);
      sprite.visible = true;
      sprite.position.set(p.x, p.y);
      sprite.scale.set(look.scale);
      sprite.alpha = look.alpha * alpha;
    }
  }

  private animateWater(show: boolean): void {
    for (const chunk of this.chunks) {
      chunk.water.visible = show;
      if (!show || !chunk.root.visible) continue;
      const g = this.glints.get(chunk);
      if (!g) continue;
      for (let k = 0; k < g.sprites.length; k++) {
        const a = sparkleAlpha(g.spots[k] as SparkleSpot, this.time);
        const sprite = g.sprites[k] as Sprite;
        sprite.visible = a > 0.01;
        if (sprite.visible) sprite.alpha = a;
      }
    }
  }
}

function spriteKey(v: Vehicle): number {
  return v.kind === 'fireTruck' ? -v.id : v.id;
}

/** A boat on a water road is under the span; everywhere else it stays above the roads. */
function underSpan(world: World, x: number, y: number): boolean {
  const i = world.index(x, y);
  return world.isWater(i) && world.hasInfra(i, Infra.Road);
}

/** Footfall a lot adds to each street beside it, by what it is. */
function footfallOf(b: BuildingRecord): number {
  if (b.abandoned || b.occupancy <= 0) return 0;
  if (b.kind === 'residential') return 0.14;
  if (b.kind === 'commercial') return 0.4;
  if (b.kind === 'industrial') return 0.05;
  if (b.kind === 'caravanserai') return 0.6;
  return PLACEABLE_SPECS[b.kind].jobs > 0 ? 0.2 : 0;
}

function isStall(b: BuildingRecord): boolean {
  return (
    !b.abandoned &&
    b.occupancy > 0 &&
    (b.kind === 'commercial' || b.kind === 'caravanserai' || b.kind === 'arcade')
  );
}

/** Road tiles beside a building's footprint, each once, in N, E, S, W scan order. */
function frontage(world: World, roads: RoadView, b: BuildingRecord): number[] {
  const out: number[] = [];
  const add = (x: number, y: number) => {
    if (!world.inBounds(x, y)) return;
    const i = world.index(x, y);
    if (roads.hasRoad(i) && !out.includes(i)) out.push(i);
  };
  for (let x = b.x; x < b.x + b.w; x++) {
    add(x, b.y - 1);
    add(x, b.y + b.h);
  }
  for (let y = b.y; y < b.y + b.h; y++) {
    add(b.x - 1, y);
    add(b.x + b.w, y);
  }
  return out;
}

/** Footfall and stalls per road tile, from the occupied lots that front each street. */
export function streetLife(
  world: World,
  roads: RoadView,
  buildings: Map<number, BuildingRecord>,
): StreetLife {
  const footfall = new Float32Array(world.tileCount);
  const stalls = new Uint8Array(world.tileCount);
  for (const b of buildings.values()) {
    const people = footfallOf(b);
    if (people <= 0) continue;
    const stall = isStall(b);
    for (const i of frontage(world, roads, b)) {
      footfall[i] = (footfall[i] as number) + people;
      if (stall) stalls[i] = 1;
    }
  }
  return { ...roads, footfall, stalls };
}

/** One route per staffed caravanserai with a road door, in building order. */
export function caravanRoutes(
  world: World,
  roads: RoadView,
  buildings: Map<number, BuildingRecord>,
): CaravanRoute[] {
  const routes: CaravanRoute[] = [];
  for (const b of buildings.values()) {
    if (b.kind !== 'caravanserai' || b.occupancy <= 0 || b.abandoned) continue;
    const route = caravanRoute(roads, frontage(world, roads, b));
    if (route) routes.push(route);
  }
  return routes;
}
