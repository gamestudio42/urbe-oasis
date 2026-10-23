import {
  Fnv1a,
  type CityStats,
  type Command,
  type CommandResult,
  type DisasterKind,
  type LoadResult,
  type Speed,
  type Tile,
} from '@city/shared';
import type { MusicStatus } from '../audio/sound';
import type { SaveSlot } from '../persistence/saves';
import type {
  AnimationStats,
  HubSample,
  VehicleSample,
} from '@view/city';
import type { Point } from '@view/city';
import type { BootState, GameSession } from './session';

/** Read-mostly hooks used by Playwright tests and for debugging in the console. */
export interface CityDebugApi {
  isReady(): boolean;
  getSelected(): Point | null;
  getHover(): Point | null;
  getTile(x: number, y: number): Tile | null;
  getStats(): CityStats | null;
  tileToClient(x: number, y: number): Point | null;
  centerOnTile(x: number, y: number): void;
  /** Sets the camera zoom, keeping the current centre. */
  setZoom(zoom: number): void;
  /** Id and architecture style of the theme the renderer is drawing with. */
  themeInfo(): { id: string; style: string };
  findFlatArea(width: number, height: number): Point | null;
  command(command: Command): Promise<CommandResult>;
  runTicks(ticks: number): Promise<void>;
  setSpeed(speed: Speed): void;
  hash(): Promise<string>;
  terrainHash(): string | null;
  fps(): number;
  /** Live cars, fire engines, smoke puffs and visible water glints. */
  animationStats(): AnimationStats;
  /** Screen positions of a few vehicles. */
  vehicleSample(): VehicleSample[];
  /** Screen positions of boats and planes, in world (not client) pixels. */
  hubSample(): HubSample[];
  /** Back-to-front labels of a map chunk (boats must sit under roads). */
  chunkStack(): string[];
  /** Background music: toggle, whether bars are being scheduled, current track, pause ducking. */
  musicState(): MusicStatus;
  /** Steps of the loading screen. */
  bootStep(): BootState['step'];
  /** Encoded save of the current city. */
  exportText(): Promise<string>;
  importText(text: string): Promise<LoadResult>;
  saveGame(autosave?: boolean): Promise<boolean>;
  listSaves(): Promise<SaveSlot[]>;
  triggerDisaster(disaster: DisasterKind, x?: number, y?: number): Promise<CommandResult>;
  /** Queues a cosmetic fire engine even if the `fireStarted` event was already drained. */
  reportFire(x: number, y: number): void;
}

declare global {
  interface Window {
    __cityDebug?: CityDebugApi;
  }
}

export function installDebugApi(session: GameSession): void {
  const api: CityDebugApi = {
    isReady: () => session.ui.get().ready && session.ui.get().screen === 'game',
    getSelected: () => session.ui.get().selected,
    getHover: () => session.ui.get().hover,
    getTile: (x, y) => {
      const w = session.client.world;
      return w && w.inBounds(x, y) ? w.getTile(x, y) : null;
    },
    getStats: () => session.client.stats,
    tileToClient: (x, y) => session.renderer.tileToClient(x, y),
    centerOnTile: (x, y) => session.renderer.centerOnTile(x, y),
    setZoom: (zoom) => session.renderer.setZoom(zoom),
    themeInfo: () => ({ id: session.renderer.theme.id, style: session.renderer.theme.style }),
    findFlatArea: (width, height) => {
      const w = session.client.world;
      if (!w) return null;
      const cx = Math.floor(w.size / 2);
      for (let r = 0; r < w.size / 2; r++) {
        for (let y = cx - r; y <= cx + r; y++) {
          for (let x = cx - r; x <= cx + r; x++) {
            if (isFlatDryArea(session, x, y, width, height)) return { x, y };
          }
        }
      }
      return null;
    },
    command: (command) => session.client.command(command),
    runTicks: (ticks) => session.client.runTicks(ticks),
    setSpeed: (speed) => session.setSpeed(speed),
    hash: () => session.client.hash(),
    terrainHash: () => {
      const w = session.client.world;
      return w ? new Fnv1a().bytes(w.heights).bytes(w.terrain).bytes(w.trees).hex() : null;
    },
    fps: () => session.renderer.fps,
    animationStats: () => session.renderer.animationStats(),
    vehicleSample: () => session.renderer.vehicleSample(),
    hubSample: () => session.renderer.hubSample(),
    chunkStack: () => session.renderer.chunkStack(),
    musicState: () => session.sound.musicStatus(),
    bootStep: () => session.ui.get().boot.step,
    exportText: async () => (await session.client.exportSave(new Date().toISOString())).text,
    importText: (text) => session.importText(text),
    saveGame: (autosave) => session.saveGame(autosave),
    listSaves: async () => {
      await session.refreshSaves();
      return session.ui.get().saves;
    },
    triggerDisaster: (disaster, x, y) =>
      session.client.command(
        x === undefined || y === undefined
          ? { type: 'triggerDisaster', disaster }
          : { type: 'triggerDisaster', disaster, x, y },
      ),
    reportFire: (x, y) => session.renderer.reportFire(x, y),
  };
  window.__cityDebug = api;
}

function isFlatDryArea(
  session: GameSession,
  x0: number,
  y0: number,
  width: number,
  height: number,
): boolean {
  const w = session.client.world;
  if (!w) return false;
  const h = w.inBounds(x0, y0) ? w.elevation(x0, y0) : -1;
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      if (!w.inBounds(x, y)) return false;
      const i = w.index(x, y);
      if (
        w.isWater(i) ||
        !w.isFlat(x, y) ||
        w.elevation(x, y) !== h ||
        w.buildingId[i] !== 0 ||
        w.infra[i] !== 0
      )
        return false;
    }
  }
  return true;
}
