import { RejectReason, type Area, type CommandResult, type ToolCommand } from '@city/shared';
import {
  planToolCommand,
  serviceNetworkOf,
  traceService,
  type ServiceNetwork,
  type SourceIssue,
  type ToolPlan,
} from '@city/simulation';
import type { HighlightTile, OverlayMode } from '@view/city';
import type { Point } from '@view/city';
import type { GameSession } from '../state/session';
import { toolById, type ToolDef, type ToolId } from './tools';

export interface ToolPreview {
  ok: boolean;
  cost: number;
  count: number;
  skipped: number;
  unchanged: number;
  dragging: boolean;
  reason?: RejectReason;
  /** Oasis only: the network this command would extend, with today's sources in reach. */
  network?: NetworkPreview;
}

export interface NetworkPreview {
  network: ServiceNetwork;
  /** Sources in reach, including a planned one. */
  sources: number;
  /** Sources adding water, power or shade right now. */
  active: number;
  /** Distinct reasons the other sources are idle or reduced. */
  issues: SourceIssue[];
  /** The planned building's own problem, if it is a source. */
  plannedIssue: SourceIssue | null;
  /** Expected output of a planned source. */
  plannedSupply: number | null;
  supply: number;
  reserve: number;
  demand: number;
  consumers: number;
}

const NETWORK_OVERLAY: Record<ServiceNetwork, OverlayMode> = {
  power: 'power',
  water: 'water',
  shade: 'data',
};

/** A receipt belongs to the submitted tool, even if another tool is selected before it returns. */
export type ConstructionFeedback = { id: number; tool: ToolId } & (
  { phase: 'pending' } | { phase: 'complete'; result: CommandResult } | { phase: 'failed' }
);

/** Turns pointer input into tool commands, with a live local preview on the mirror world. */
export class ToolController {
  private start: Point | null = null;
  private end: Point | null = null;
  private dragging = false;
  private previewFrame: number | null = null;
  private previewTile: Point | null = null;
  private feedbackId = 0;
  private settledPlacement: Point | null = null;
  /** Overlay this controller opened for a network tool, closed again when the tool changes. */
  private autoOverlay: OverlayMode | null = null;
  /** Whether the drawn service reach is this controller's preview; the inspector owns others. */
  private ownsTrace = false;

  constructor(private readonly session: GameSession) {}

  get tool(): ToolDef {
    return toolById(this.session.ui.get().tool);
  }

  setTool(id: ToolId): void {
    const previous = this.tool;
    this.cancel();
    const next = toolById(id);
    this.session.ui.set({ tool: id });
    if (next.underground) this.session.setUnderground(true);
    else if (previous.underground) this.session.setUnderground(false);
    this.followNetworkOverlay(id);
    this.refresh(this.session.ui.get().hover);
  }

  cancel(): void {
    if (this.previewFrame !== null) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = null;
    this.previewTile = null;
    this.settledPlacement = null;
    this.dragging = false;
    this.start = null;
    this.end = null;
    this.session.renderer.setHighlight([]);
    this.session.renderer.setPlacementPreview(null);
    this.clearTrace();
    this.session.ui.set({ preview: null });
  }

  private clearTrace(): void {
    if (!this.ownsTrace) return;
    this.ownsTrace = false;
    this.session.renderer.setServiceTrace(null);
  }

  /** Network tools show the served area; the player's own overlay choice always wins. */
  private followNetworkOverlay(id: ToolId): void {
    const overlay = this.session.ui.get().overlay;
    if (this.autoOverlay && overlay === this.autoOverlay) this.session.setOverlay('none');
    this.autoOverlay = null;
    const network = this.session.client.stats?.ruleset === 'oasis' ? serviceNetworkOf(id) : null;
    if (!network || this.session.ui.get().overlay !== 'none') return;
    this.autoOverlay = NETWORK_OVERLAY[network];
    this.session.setOverlay(this.autoOverlay);
  }

  onHover(tile: Point | null): void {
    this.settledPlacement = null;
    // A new map target starts a new plan; keep the last receipt while the pointer rests.
    const feedback = this.session.ui.get().constructionFeedback;
    if (tile && feedback && feedback.phase !== 'pending')
      this.session.ui.set({ constructionFeedback: null });
    if (!this.dragging) this.refresh(tile);
  }

  onPointer(kind: 'down' | 'move' | 'up', tile: Point | null): void {
    const tool = this.tool;
    if (tool.shape === 'none') {
      if (kind === 'down' && tile) this.session.select(tile);
      return;
    }
    if (kind === 'down' && tile) {
      this.settledPlacement = null;
      if (tool.shape === 'footprint') {
        void this.commit({ x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y });
        return;
      }
      this.dragging = true;
      this.start = tile;
      this.end = tile;
      this.refresh(tile);
    } else if (kind === 'move' && this.dragging && tile) {
      if (this.end && tile.x === this.end.x && tile.y === this.end.y) return;
      this.end = tile;
      this.refresh(tile);
    } else if (kind === 'up' && this.dragging) {
      if (!tile) {
        this.cancel();
        return;
      }
      // The release can arrive before another move event (or before the preview frame).
      this.end = tile;
      const area = this.area();
      this.dragging = false;
      this.start = null;
      this.end = null;
      if (area) void this.commit(area);
      this.refresh(tile);
    }
  }

  /** Re-evaluates the preview after the mirror world changed. */
  refreshCurrent(): void {
    this.refresh(this.dragging ? this.end : this.session.ui.get().hover);
  }

  private area(): Area | null {
    if (!this.start || !this.end) return null;
    return { x0: this.start.x, y0: this.start.y, x1: this.end.x, y1: this.end.y };
  }

  private commandFor(area: Area): ToolCommand | null {
    const command = this.tool.command(area);
    if (command?.type === 'demolish' && this.session.ui.get().underground)
      return { ...command, underground: true };
    return command;
  }

  private plan(command: ToolCommand): ToolPlan | null {
    const client = this.session.client;
    const world = client.world;
    const stats = client.stats;
    if (!world || !stats) return null;
    return planToolCommand(
      {
        world,
        building: (id) => client.buildings.get(id),
        funds: stats.funds,
        bankrupt: stats.bankrupt,
        population: stats.population,
        ruleset: stats.ruleset,
        ...(stats.oasis?.journey?.era ? { eraRank: stats.oasis.journey.era.rank } : {}),
        has: (kind) => client.hasBuilding(kind),
      },
      command,
    );
  }

  private refresh(tile: Point | null): void {
    this.previewTile = tile;
    if (this.previewFrame !== null) return;
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = null;
      this.drawPreview(this.previewTile);
    });
  }

  /** Only the latest cursor position and mirror state matter for the next rendered frame. */
  private drawPreview(tile: Point | null): void {
    const tool = this.tool;
    const renderer = this.session.renderer;
    if (
      tool.shape === 'none' ||
      !tile ||
      (this.settledPlacement?.x === tile.x && this.settledPlacement.y === tile.y)
    ) {
      renderer.setHighlight([]);
      renderer.setPlacementPreview(null);
      this.clearTrace();
      this.session.ui.set({ preview: null });
      return;
    }
    const area = this.dragging ? this.area() : { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y };
    const command = area ? this.commandFor(area) : null;
    const plan = command ? this.plan(command) : null;
    const world = this.session.client.world;
    if (!plan || !world) {
      renderer.setHighlight([]);
      renderer.setPlacementPreview(null);
      this.clearTrace();
      this.session.ui.set({ preview: null });
      return;
    }
    const highlight: HighlightTile[] = [];
    const allBad = !plan.ok;
    for (const i of plan.valid)
      highlight.push({ x: world.xOf(i), y: world.yOf(i), state: allBad ? 'bad' : 'ok' });
    for (const r of plan.invalid) {
      if (r.index < 0) continue;
      const state = r.reason === RejectReason.AlreadyBuilt ? 'neutral' : 'bad';
      highlight.push({ x: world.xOf(r.index), y: world.yOf(r.index), state });
    }
    renderer.setHighlight(highlight);
    renderer.setPlacementPreview(
      command?.type === 'place' && this.session.client.stats?.ruleset === 'oasis'
        ? { kind: command.kind, x: command.x, y: command.y, ok: plan.ok }
        : null,
    );
    const preview: ToolPreview = {
      ok: plan.ok,
      cost: plan.cost,
      count: plan.valid.length,
      skipped: plan.invalid.length,
      unchanged: plan.invalid.filter((r) => r.reason === RejectReason.AlreadyBuilt).length,
      dragging: this.dragging,
    };
    if (plan.reason) preview.reason = plan.reason;
    const network = command ? this.networkPreview(command, plan) : null;
    if (network) preview.network = network;
    this.session.ui.set({ preview });
  }

  /** Traces the network the planned tiles would join and draws it under the plan. */
  private networkPreview(command: ToolCommand, plan: ToolPlan): NetworkPreview | null {
    const renderer = this.session.renderer;
    const network = serviceNetworkOf(this.tool.id);
    const ctx = network ? this.session.serviceContext() : null;
    if (!network || !ctx) {
      this.clearTrace();
      return null;
    }
    const tiles = [
      ...plan.valid,
      ...plan.invalid.filter((r) => r.reason === RejectReason.AlreadyBuilt).map((r) => r.index),
    ];
    const building =
      command.type === 'place' ? { kind: command.kind, x: command.x, y: command.y } : undefined;
    const start = building ? [ctx.world.index(building.x, building.y)] : tiles;
    const trace = traceService(ctx, network, start, building ? { tiles, building } : { tiles });
    this.ownsTrace = true;
    renderer.setServiceTrace({
      tiles: trace.tiles,
      sources: trace.sources.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, ok: s.supply > 0 })),
    });
    const planned = trace.sources.find((s) => s.planned) ?? null;
    const issues: SourceIssue[] = [];
    for (const s of trace.sources)
      if (!s.planned && s.issue && !issues.includes(s.issue)) issues.push(s.issue);
    return {
      network,
      sources: trace.sources.length,
      active: trace.sources.filter((s) => s.supply > 0).length,
      issues,
      plannedIssue: planned?.issue ?? null,
      plannedSupply: planned ? planned.supply : null,
      supply: trace.supply,
      reserve: trace.reserve,
      demand: trace.demand,
      consumers: trace.consumers,
    };
  }

  private async commit(area: Area): Promise<void> {
    const command = this.commandFor(area);
    if (!command) return;
    const tool = this.tool.id;
    const world = this.session.client.world;
    const revision = this.session.ui.get().cityRevision;
    const screen = this.session.ui.get().screen;
    const id = ++this.feedbackId;
    const oasis = this.session.client.stats?.ruleset === 'oasis';
    if (oasis) this.session.ui.set({ constructionFeedback: { id, tool, phase: 'pending' } });
    let result: CommandResult;
    try {
      result = await this.session.client.command(command);
    } catch {
      if (
        world === this.session.client.world &&
        revision === this.session.ui.get().cityRevision &&
        screen === this.session.ui.get().screen &&
        this.session.ui.get().constructionFeedback?.id === id
      )
        this.session.ui.set({ constructionFeedback: { id, tool, phase: 'failed' } });
      return;
    }
    // A response from a previous city or a closed screen must not leak into the new session.
    if (
      world !== this.session.client.world ||
      revision !== this.session.ui.get().cityRevision ||
      screen !== this.session.ui.get().screen
    )
      return;
    if (oasis && this.session.ui.get().constructionFeedback?.id === id)
      this.session.ui.set({ constructionFeedback: { id, tool, phase: 'complete', result } });
    if (!result.ok && result.reason) this.session.notifyReason(result.reason, !oasis);
    else if (result.ok) this.session.onBuilt(command);
    // Let the finished building read clearly; worker updates must not revive an occupied ghost.
    if (oasis && result.ok && command.type === 'place' && this.tool.id === tool)
      this.settledPlacement = { x: area.x1, y: area.y1 };
    this.refreshCurrent();
  }
}
