import { RejectReason, type Area, type ToolCommand } from '@city/shared';
import { planToolCommand, type ToolPlan } from '@city/simulation';
import type { HighlightTile } from '@view/city';
import type { Point } from '@view/city';
import type { GameSession } from '../state/session';
import { toolById, type ToolDef, type ToolId } from './tools';

export interface ToolPreview {
  ok: boolean;
  cost: number;
  count: number;
  reason?: RejectReason;
}

/** Turns pointer input into tool commands, with a live local preview on the mirror world. */
export class ToolController {
  private start: Point | null = null;
  private end: Point | null = null;
  private dragging = false;
  private previewFrame: number | null = null;
  private previewTile: Point | null = null;

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
    this.refresh(this.session.ui.get().hover);
  }

  cancel(): void {
    if (this.previewFrame !== null) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = null;
    this.previewTile = null;
    this.dragging = false;
    this.start = null;
    this.end = null;
    this.session.renderer.setHighlight([]);
    this.session.ui.set({ preview: null });
  }

  onHover(tile: Point | null): void {
    if (!this.dragging) this.refresh(tile);
  }

  onPointer(kind: 'down' | 'move' | 'up', tile: Point | null): void {
    const tool = this.tool;
    if (tool.shape === 'none') {
      if (kind === 'down' && tile) this.session.select(tile);
      return;
    }
    if (kind === 'down' && tile) {
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
    if (tool.shape === 'none' || !tile) {
      renderer.setHighlight([]);
      this.session.ui.set({ preview: null });
      return;
    }
    const area = this.dragging ? this.area() : { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y };
    const command = area ? this.commandFor(area) : null;
    const plan = command ? this.plan(command) : null;
    const world = this.session.client.world;
    if (!plan || !world) {
      renderer.setHighlight([]);
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
    const preview: ToolPreview = { ok: plan.ok, cost: plan.cost, count: plan.valid.length };
    if (plan.reason) preview.reason = plan.reason;
    this.session.ui.set({ preview });
  }

  private async commit(area: Area): Promise<void> {
    const command = this.commandFor(area);
    if (!command) return;
    const result = await this.session.client.command(command);
    if (!result.ok && result.reason) this.session.notifyReason(result.reason);
    else if (result.ok) this.session.onBuilt(command);
    this.refreshCurrent();
  }
}
