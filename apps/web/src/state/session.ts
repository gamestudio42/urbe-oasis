import {
  OASIS_SAVE_FORMAT,
  PLACEABLE_KINDS,
  PLACEABLE_SPECS,
  SAVE_FORMAT,
  type CityStats,
  type Command,
  type CommandResult,
  type HistoryEntry,
  type LoadResult,
  type NewCityOptions,
  type RejectReason,
  type SimEvent,
  type Speed,
  type ToolCommand,
} from '@city/shared';
import { RoadNetwork, type World } from '@city/simulation';
import type { Theme } from '@theme/core';
import { urbe } from '@theme/urbe';
import { SoundBoard, type MusicFactory, type SoundName } from '../audio/sound';
import {
  applyDocumentLocale,
  bootLocale,
  catalog,
  formatNumber,
  persistLocale,
  type Locale,
} from '../i18n';
import { prefersReducedMotion } from '../motion';
import {
  AUTOSAVE_ID,
  deleteSave,
  listSaves,
  manualSlotId,
  readSave,
  saveFileName,
  SaveStorageError,
  writeSave,
  type SaveSlot,
} from '../persistence/saves';
import { GameRenderer } from '@view/city';
import type { OverlayMode } from '@view/city';
import type { Point } from '@view/city';
import { ToolController, type ToolPreview, type ConstructionFeedback } from '../tools/controller';
import { toolByHotkey, type ToolId } from '../tools/tools';
import { CityClient } from './client';
import { installDebugApi } from './debug';
import { Store } from './store';
import { markTutorialDone, tutorialChecks, tutorialDone } from './tutorial';
import { appendOasisDispatches, type OasisDispatch } from './oasisDispatches';
import { isOasisMoment } from '@view/city';

export interface Toast {
  id: number;
  kind: 'info' | 'warning' | 'error';
  message: string;
}

export type PanelId = 'budget' | 'charts' | 'overlays' | 'system';
export type Screen = 'menu' | 'game';

export interface BootState {
  step: 'graphics' | 'city' | 'done';
  /** 0..1 across both steps. */
  progress: number;
}

export interface UiState {
  boot: BootState;
  screen: Screen;
  /** Floating panel currently open (one at a time). */
  panel: PanelId | null;
  /** Current tutorial step, or null when the tutorial is hidden. */
  tutorial: number | null;
  ready: boolean;
  hover: Point | null;
  selected: Point | null;
  overlay: OverlayMode;
  underground: boolean;
  grid: boolean;
  speed: Speed;
  stats: CityStats | null;
  history: HistoryEntry[];
  tool: ToolId;
  preview: ToolPreview | null;
  constructionFeedback: ConstructionFeedback | null;
  /** Client position of the pointer over the map, for the tool tooltip. */
  pointer: Point | null;
  toasts: Toast[];
  oasisDispatches: OasisDispatch[];
  cityRevision: number;
  /** Saved cities in IndexedDB, most recent first. */
  saves: SaveSlot[];
  /** A save or load is in progress. */
  busy: boolean;
  /** All sound off (persisted in localStorage). */
  muted: boolean;
  /** Background music on (persisted in localStorage). */
  music: boolean;
  /** Cars, smoke, water glints and fire engines (persisted in localStorage). */
  animations: boolean;
  /** Player language (persisted in localStorage). */
  locale: Locale;
}

const initialUi: UiState = {
  boot: { step: 'graphics', progress: 0 },
  screen: 'menu',
  panel: null,
  tutorial: null,
  ready: false,
  hover: null,
  selected: null,
  overlay: 'none',
  underground: false,
  grid: false,
  speed: 1,
  stats: null,
  history: [],
  tool: 'select',
  preview: null,
  constructionFeedback: null,
  pointer: null,
  toasts: [],
  oasisDispatches: [],
  cityRevision: 0,
  saves: [],
  busy: false,
  muted: false,
  music: true,
  animations: true,
  locale: 'en',
};

const ANIMATIONS_KEY = 'cityBuilder.animations';

/** Stored choice, or on unless the system asks for reduced motion. */
function readAnimations(): boolean {
  try {
    const stored = localStorage.getItem(ANIMATIONS_KEY);
    if (stored !== null) return stored === '1';
    return !prefersReducedMotion();
  } catch {
    return true;
  }
}

const EVENT_SOUNDS: Partial<Record<SimEvent['type'], SoundName>> = {
  fireStarted: 'fire',
  buildingDestroyed: 'demolish',
  disasterStarted: 'disaster',
  brownout: 'warning',
  waterShortage: 'warning',
  debt: 'warning',
  bankrupt: 'error',
  milestone: 'milestone',
};

const TOAST_MS = 3500;
/** Real time between autosaves while the game screen is open. */
const AUTOSAVE_MS = 60_000;
const AUTOSAVE_CHECK_MS = 5_000;
/** Scripted city behind the main menu; months are simulated during boot. */
const MENU_CITY = { seed: 'urbe-menu', size: 64, months: 60 } as const;
/** Share of the boot progress bar taken by the graphics step. */
const GRAPHICS_SHARE = 0.25;

/** Options that let a different art direction reuse the whole session. */
export interface SessionOptions {
  /** Art direction for the renderer; defaults to Urbe. */
  theme?: Theme;
  /** Seed of the scripted menu city; each game uses its own so the backgrounds differ. */
  menuSeed?: string;
  /** Rules for cities created from this app; defaults to `classic`. */
  ruleset?: 'classic' | 'oasis';
  /** Music engine factory, so a reskin can supply its own composer. */
  music?: MusicFactory;
}

/** Wires the worker client, the renderer, the tools and the UI store together. */
export class GameSession {
  readonly client = new CityClient();
  readonly renderer: GameRenderer;
  readonly sound: SoundBoard;
  readonly ui: Store<UiState>;
  readonly tools = new ToolController(this);
  private readonly eventListeners = new Set<(events: SimEvent[]) => void>();
  private readonly cameraListeners = new Set<() => void>();
  private readonly tileListeners = new Set<() => void>();
  private readonly listeners = new AbortController();
  private roadCache: { world: World; roads: RoadNetwork } | null = null;
  private nextToastId = 1;
  private disposed = false;
  private speedBeforePause: Speed = 1;
  private lastAutosave = { time: 0, tick: -1 };
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionOptions = {}) {
    this.renderer = new GameRenderer(options.theme ?? urbe);
    this.sound = new SoundBoard({
      ...(options.music ? { music: options.music } : {}),
      ...(options.ruleset === 'oasis' ? { preferenceScope: 'oasis.audio' } : {}),
    });
    this.ui = new Store<UiState>({
      ...initialUi,
      locale: bootLocale(),
      muted: this.sound.muted,
      music: this.sound.musicEnabled,
      animations: readAnimations(),
    });
    this.menuSeed = options.menuSeed ?? MENU_CITY.seed;
    this.ruleset = options.ruleset ?? 'classic';
    this.foundingRuleset = this.ruleset;
  }

  /** Seed of the scripted city behind the main menu. */
  readonly menuSeed: string;
  /** Importing a classic save must not change the kind of city founded by this app. */
  readonly foundingRuleset: 'classic' | 'oasis';
  /**
   * Rules the current city runs under. It starts as the app's own ruleset and follows the file
   * when a save is loaded, so opening a classic city in Urbe Oasis shows classic panels.
   */
  ruleset: 'classic' | 'oasis';

  /** Envelope format this app reads and writes; Urbe Oasis exports its own file format. */
  saveFormat(): string {
    return this.ruleset === 'oasis' ? OASIS_SAVE_FORMAT : SAVE_FORMAT;
  }

  /**
   * Starts the renderer, wires input and builds the live city behind the main menu. The boot
   * always ends in the `done` step, so a failure only costs the menu background.
   */
  async boot(host: HTMLElement): Promise<void> {
    applyDocumentLocale(this.ui.get().locale);
    this.setBoot('graphics', 0);
    this.syncMusic();
    this.renderer.setAnimations(this.ui.get().animations);
    this.renderer.setSimSpeed(this.ui.get().speed);
    let graphics = true;
    try {
      await this.renderer.init(host);
    } catch (error) {
      graphics = false;
      console.error('[boot] renderer', error);
    }
    if (this.disposed) return;
    this.wire(host);
    if (graphics) {
      this.setBoot('city', GRAPHICS_SHARE);
      try {
        await this.client.demoCity(
          {
            seed: this.menuSeed,
            size: MENU_CITY.size,
            months: MENU_CITY.months,
            ruleset: this.ruleset,
            saveFormat: this.saveFormat(),
          },
          (done, total) =>
            this.setBoot('city', GRAPHICS_SHARE + ((1 - GRAPHICS_SHARE) * done) / total),
        );
        if (this.disposed) return;
        this.renderer.setAttract(true);
      } catch (error) {
        console.warn('[boot] menu city', error);
      }
    }
    if (this.disposed) return;
    this.setBoot('done', 1);
  }

  private setBoot(step: BootState['step'], progress: number): void {
    this.ui.set({ boot: { step, progress } });
  }

  private wire(host: HTMLElement): void {
    this.client.subscribe({
      onInit: () => {
        const world = this.client.world;
        if (world) this.renderer.setWorld(world, this.client.buildings);
        this.tools.cancel();
        this.ui.set({
          ready: true,
          selected: null,
          hover: null,
          oasisDispatches: [],
          constructionFeedback: null,
          cityRevision: this.ui.get().cityRevision + 1,
        });
      },
      onTiles: (indices, all) => {
        this.renderer.invalidateTiles(all ? null : indices);
        this.notifyTiles();
      },
      onBuildings: (changed) => {
        this.renderer.invalidateBuildings(changed);
        this.notifyTiles();
      },
      onInfluence: () => {
        this.renderer.invalidateOverlay();
        this.notifyTiles();
      },
      onStats: (stats) => {
        this.ui.set({ stats });
        // Stats are emitted after the complete mirror delta, including its current funds.
        this.tools.refreshCurrent();
        this.renderer.setSpring(stats.oasis?.spring ?? null);
        this.checkTutorial();
      },
      onHistory: (history) => this.ui.set({ history }),
      onEvents: (events) => {
        const inGame = this.ui.get().screen === 'game';
        if (inGame && this.client.stats?.ruleset === 'oasis') {
          this.ui.set({
            oasisDispatches: appendOasisDispatches(
              this.ui.get().oasisDispatches,
              events,
              this.client.stats.tick,
            ),
          });
        }
        for (const event of events) {
          if (inGame && this.client.stats?.ruleset === 'oasis' && isOasisMoment(event)) {
            this.renderer.reportOasisMoment(event);
          }
          if (inGame) this.announce(event);
          if (event.type === 'fireStarted') this.renderer.reportFire(event.x, event.y);
        }
        for (const listener of this.eventListeners) listener(events);
      },
      onError: (message) => this.toast('error', message),
    });
    this.renderer.setInput({
      onHover: (tile) => {
        this.ui.set({ hover: tile });
        this.tools.onHover(tile);
      },
      onPointer: (kind, tile, event) => {
        this.ui.set({ pointer: { x: event.clientX, y: event.clientY } });
        this.tools.onPointer(kind, tile);
      },
      onCancel: () => this.tools.cancel(),
      onCamera: () => {
        for (const listener of this.cameraListeners) listener();
      },
    });
    window.addEventListener('keydown', (e) => this.onKey(e), { signal: this.listeners.signal });
    for (const type of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(type, () => this.sound.unlock(), { signal: this.listeners.signal });
    }
    host.addEventListener('pointerleave', () => this.ui.set({ pointer: null }), {
      signal: this.listeners.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') void this.autosave(true);
      },
      { signal: this.listeners.signal },
    );
    this.autosaveTimer = setInterval(() => void this.autosave(false), AUTOSAVE_CHECK_MS);
    installDebugApi(this);
    void this.refreshSaves();
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.client.newCity({ ...options, ruleset: options.ruleset ?? this.ruleset });
  }

  /** Road graph of the mirror world, recomputed lazily when tiles change. */
  roads(): RoadNetwork | null {
    const world = this.client.world;
    if (!world) return null;
    if (!this.roadCache || this.roadCache.world !== world) {
      this.roadCache = { world, roads: new RoadNetwork(world) };
    }
    this.roadCache.roads.update();
    return this.roadCache.roads;
  }

  /** Creates a city from the main menu and switches to the game screen. */
  async startCity(options: NewCityOptions): Promise<void> {
    const ruleset = this.foundingRuleset;
    await this.client.newCity({ ...options, ruleset });
    this.ruleset = ruleset;
    this.enterGame({ tutorial: true });
  }

  /** Shows the game screen after a city was created or loaded (loaded cities start paused). */
  enterGame({ tutorial, paused = false }: { tutorial: boolean; paused?: boolean }): void {
    const showTutorial = tutorial && !tutorialDone(this.ruleset);
    this.ui.set({
      screen: 'game',
      panel: null,
      tutorial: showTutorial ? 0 : null,
      selected: null,
    });
    this.lastAutosave = { time: Date.now(), tick: this.client.stats?.tick ?? -1 };
    this.renderer.setAttract(false);
    this.setTool('select');
    this.setSpeed(paused || (showTutorial && this.ruleset === 'oasis') ? 0 : 1);
    const w = this.client.world;
    if (w) this.renderer.centerOnTile(Math.floor(w.size / 2), Math.floor(w.size / 2));
    if (this.ruleset === 'oasis') this.focusSpring();
  }

  focusSpring(): void {
    const spring = this.client.stats?.oasis?.spring;
    if (!spring) return;
    this.setUnderground(false);
    this.renderer.centerOnTile(spring.x, spring.y);
  }

  /** Back to the menu: the player's city stays behind it, paused, with animations running. */
  async backToMenu(): Promise<void> {
    this.setSpeed(0);
    await this.autosave(true);
    this.tools.cancel();
    this.ui.set({
      screen: 'menu',
      panel: null,
      tutorial: null,
      selected: null,
      hover: null,
      constructionFeedback: null,
    });
    this.renderer.setHighlight([]);
    this.renderer.setSimSpeed(1);
    this.renderer.setAttract(true);
    this.syncMusic();
  }

  // Saves -------------------------------------------------------------------

  async refreshSaves(): Promise<void> {
    try {
      this.ui.set({ saves: await listSaves(this.foundingRuleset) });
    } catch (error) {
      // Without IndexedDB the menu simply shows no saves; export/import still work.
      console.warn('[saves]', error);
      this.ui.set({ saves: [] });
    }
  }

  /** Saves the current city into its manual slot (or the autosave slot). */
  async saveGame(autosave = false): Promise<boolean> {
    if (!this.client.world || this.ui.get().busy) return false;
    this.ui.set({ busy: true });
    try {
      const { text, meta } = await this.client.exportSave(new Date().toISOString());
      const id = autosave ? AUTOSAVE_ID : manualSlotId(meta.name, meta.seed);
      await writeSave(this.foundingRuleset, { ...meta, id, autosave, bytes: text.length }, text);
      this.lastAutosave = { time: Date.now(), tick: meta.tick };
      if (!autosave) this.toast('info', this.strings().save.saved);
      await this.refreshSaves();
      return true;
    } catch (error) {
      this.reportStorageError(error, this.strings().save.failed);
      return false;
    } finally {
      this.ui.set({ busy: false });
    }
  }

  /** Autosaves when the game is on screen and time has passed since the last save. */
  private async autosave(force: boolean): Promise<void> {
    const ui = this.ui.get();
    const tick = this.client.stats?.tick ?? -1;
    if (ui.screen !== 'game' || ui.busy || tick === this.lastAutosave.tick) return;
    if (!force && Date.now() - this.lastAutosave.time < AUTOSAVE_MS) return;
    await this.saveGame(true);
  }

  async loadSlot(id: string): Promise<LoadResult | null> {
    try {
      return await this.importText(await readSave(this.foundingRuleset, id));
    } catch (error) {
      if (error instanceof SaveStorageError && error.kind === 'missing') {
        await deleteSave(this.foundingRuleset, id).catch(() => undefined);
        await this.refreshSaves();
      }
      this.reportStorageError(error, this.strings().save.loadFailed);
      return null;
    }
  }

  async continueLatest(): Promise<void> {
    const latest = this.ui.get().saves[0];
    if (latest) await this.loadSlot(latest.id);
  }

  async deleteSlot(id: string): Promise<void> {
    try {
      await deleteSave(this.foundingRuleset, id);
    } catch (error) {
      this.reportStorageError(error, this.strings().save.failed);
    }
    await this.refreshSaves();
  }

  /** Validates and loads save text (from IndexedDB or a file). */
  async importText(text: string): Promise<LoadResult> {
    this.ui.set({ busy: true });
    try {
      // The format travels with the import: a file can be opened before any city exists, when the
      // worker has not learned the ruleset yet.
      const result = await this.client.importSave(text, this.saveFormat());
      if (!result.ok) {
        const first = result.errors[0];
        console.warn('[saves] invalid save', result.errors);
        this.toast(
          'error',
          `${this.strings().save.loadFailed} ${first ? this.strings().save.errors[first.code] : this.strings().save.errors.INVALID}`,
        );
        return result;
      }
      this.enterGame({ tutorial: false, paused: true });
      // The file decides the rules, not the app: a classic city opened in Neo Urbe plays classic.
      this.ruleset = result.ruleset;
      this.toast('info', this.strings().save.loaded(result.meta.name));
      if (result.migratedFrom !== null)
        this.toast('info', this.strings().save.migrated(result.migratedFrom));
      return result;
    } finally {
      this.ui.set({ busy: false });
    }
  }

  async importFile(file: File): Promise<LoadResult> {
    return this.importText(await file.text());
  }

  /** Downloads the current city as a `.city.json` file. */
  async exportFile(): Promise<void> {
    if (!this.client.world) return;
    const { text, meta } = await this.client.exportSave(new Date().toISOString());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName(meta.name, this.ruleset);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    this.toast('info', this.strings().save.exported);
  }

  private reportStorageError(error: unknown, fallback: string): void {
    console.warn('[saves]', error);
    if (error instanceof SaveStorageError && error.kind !== 'unknown') {
      this.toast('error', this.strings().save[error.kind]);
    } else {
      this.toast('error', fallback);
    }
  }

  togglePanel(panel: PanelId): void {
    this.ui.set({ panel: this.ui.get().panel === panel ? null : panel });
    this.checkTutorial();
  }

  closePanel(): void {
    this.ui.set({ panel: null });
  }

  advanceTutorial(): void {
    const step = this.ui.get().tutorial;
    if (step === null) return;
    if (step + 1 >= tutorialChecks(this.ruleset).length) {
      this.skipTutorial();
      return;
    }
    this.ui.set({ tutorial: step + 1 });
    if (step === 0 && this.ruleset === 'oasis') this.setSpeed(1);
    this.checkTutorial();
  }

  /** Review the founding guide without resetting the city or its completion preference. */
  restartTutorial(): void {
    this.ui.set({ tutorial: 0, panel: null, selected: null });
    this.setSpeed(0);
  }

  skipTutorial(): void {
    markTutorialDone(this.ruleset);
    this.ui.set({ tutorial: null });
  }

  /** Sends a command and reports a refusal to the player. */
  async command(command: Command): Promise<CommandResult> {
    const result = await this.client.command(command);
    if (!result.ok && result.reason) this.notifyReason(result.reason);
    return result;
  }

  onEvents(listener: (events: SimEvent[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onCamera(listener: () => void): () => void {
    this.cameraListeners.add(listener);
    return () => this.cameraListeners.delete(listener);
  }

  /** Called when tiles, buildings or influence maps change in the mirror world. */
  onTilesChanged(listener: () => void): () => void {
    this.tileListeners.add(listener);
    return () => this.tileListeners.delete(listener);
  }

  setTool(id: ToolId): void {
    this.tools.setTool(id);
    this.renderer.setPlanning(id !== 'select');
  }

  select(tile: Point | null): void {
    this.ui.set({ selected: tile });
  }

  setSpeed(speed: Speed): void {
    if (speed !== 0) this.speedBeforePause = speed;
    this.client.setSpeed(speed);
    this.renderer.setSimSpeed(speed);
    this.ui.set({ speed });
    this.syncMusic();
  }

  /** Menu or city track for the current screen, ducked while the game is paused. */
  private syncMusic(): void {
    const { screen, speed } = this.ui.get();
    this.sound.setMusicTrack(screen === 'game' ? 'city' : 'menu');
    this.sound.setMusicDucked(screen === 'game' && speed === 0);
  }

  togglePause(): void {
    this.setSpeed(this.ui.get().speed === 0 ? this.speedBeforePause : 0);
  }

  setOverlay(overlay: OverlayMode): void {
    this.renderer.setOverlay(overlay);
    this.ui.set({ overlay });
  }

  setUnderground(underground: boolean): void {
    this.renderer.setUnderground(underground);
    this.ui.set({ underground });
  }

  setGrid(grid: boolean): void {
    this.renderer.setGrid(grid);
    this.ui.set({ grid });
  }

  toast(kind: Toast['kind'], message: string): void {
    const id = this.nextToastId++;
    const toasts = [
      ...this.ui.get().toasts.filter((x) => x.message !== message),
      { id, kind, message },
    ].slice(-4);
    this.ui.set({ toasts });
    setTimeout(() => this.dismissToast(id), TOAST_MS);
  }

  dismissToast(id: number): void {
    this.ui.set({ toasts: this.ui.get().toasts.filter((x) => x.id !== id) });
  }

  notifyReason(reason: RejectReason, showToast = true): void {
    this.sound.play('error');
    if (!showToast) return;
    this.toast(
      reason === 'INSUFFICIENT_FUNDS' || reason === 'BANKRUPT' ? 'error' : 'warning',
      this.strings().reasons[reason],
    );
  }

  onBuilt(command: ToolCommand): void {
    this.sound.play(
      command.type === 'zone' ? 'zone' : command.type === 'demolish' ? 'demolish' : 'build',
    );
    this.checkTutorial();
  }

  setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
    this.ui.set({ muted });
  }

  setMusic(music: boolean): void {
    this.sound.setMusicEnabled(music);
    this.ui.set({ music });
  }

  setAnimations(animations: boolean): void {
    this.renderer.setAnimations(animations);
    this.ui.set({ animations });
    try {
      localStorage.setItem(ANIMATIONS_KEY, animations ? '1' : '0');
    } catch {
      // Private mode or blocked storage: the choice lasts for this session only.
    }
  }

  setLocale(locale: Locale): void {
    persistLocale(locale);
    applyDocumentLocale(locale);
    this.ui.set({ locale });
  }

  private strings() {
    return catalog(this.ui.get().locale);
  }

  dispose(): void {
    this.disposed = true;
    this.tools.cancel();
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.sound.dispose();
    this.listeners.abort();
    this.renderer.destroy();
    this.client.dispose();
  }

  private notifyTiles(): void {
    for (const listener of this.tileListeners) listener();
  }

  private checkTutorial(): void {
    const step = this.ui.get().tutorial;
    if (step === null) return;
    const check = tutorialChecks(this.ruleset)[step];
    if (check?.(this)) this.advanceTutorial();
  }

  private announce(event: SimEvent): void {
    if (
      this.renderer.theme.style === 'adobe' &&
      this.client.stats?.ruleset === 'oasis' &&
      isOasisMoment(event)
    ) {
      // The Oasis journal keeps these actionable notices available after their effects fade.
      if (event.type === 'sandstorm') this.sound.play('sandstorm');
      else if (event.type === 'springMoved') this.sound.play('spring');
      else if (event.type === 'waterStress' || event.type === 'canalCollapse')
        this.sound.play('warning');
      return;
    }
    const sound = EVENT_SOUNDS[event.type];
    if (sound) this.sound.play(sound);
    const t = this.strings();
    const e = t.events;
    switch (event.type) {
      case 'fireStarted':
        return this.toast('error', e.fireStarted);
      case 'buildingDestroyed':
        return this.toast('error', e.buildingDestroyed[event.cause]);
      case 'disasterStarted':
        return this.toast('error', e.disasterStarted(t.disasters[event.disaster]));
      case 'disasterEnded':
        return this.toast('info', e.disasterEnded(t.disasters[event.disaster]));
      case 'brownout':
        return this.toast('warning', e.brownout);
      case 'waterShortage':
        return this.toast('warning', e.waterShortage);
      case 'waterStress':
        return this.toast('warning', e.waterStress);
      case 'canalCollapse':
        return this.toast('error', e.canalCollapse);
      case 'caravanTrade':
        return this.toast('info', e.caravanTrade);
      case 'caravanLeave':
        return this.toast('warning', e.caravanLeave);
      case 'sandstorm':
        return this.toast(
          event.blocked ? 'info' : 'error',
          event.blocked ? e.sandstormBlocked : e.sandstorm,
        );
      case 'springMoved':
        return this.toast('info', e.springMoved);
      case 'debt':
        return this.toast('warning', e.debt(event.months));
      case 'bankrupt':
        return this.toast('error', e.bankrupt);
      case 'recovered':
        return this.toast('info', e.recovered);
      case 'milestone': {
        this.toast('info', e.milestone(formatNumber(event.population, this.ui.get().locale)));
        const unlocked = PLACEABLE_KINDS.filter(
          (kind) => PLACEABLE_SPECS[kind].minPopulation === event.population,
        );
        if (unlocked.length > 0)
          this.toast('info', e.unlocked(unlocked.map((kind) => t.buildings[kind]).join(', ')));
        return;
      }
      case 'newYear':
        return this.toast('info', e.newYear(event.year));
    }
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    )
      return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.ui.get().screen !== 'game') return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (this.ui.get().panel) return this.closePanel();
      this.tools.cancel();
      this.setTool('select');
      this.select(null);
      return;
    }
    if (key === 'p') return this.togglePause();
    if (key === 'm') return this.setMuted(!this.ui.get().muted);
    if (key === 'u') return this.setUnderground(!this.ui.get().underground);
    if (key === 'g') return this.setGrid(!this.ui.get().grid);
    const tool = toolByHotkey(key, this.ruleset);
    if (tool) this.setTool(tool.id);
  }
}
