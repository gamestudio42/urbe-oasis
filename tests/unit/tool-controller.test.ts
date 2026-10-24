import { Infra, RejectReason, type Command, type CommandResult, type Ruleset } from '@city/shared';
import { createEngine, hashState } from '@city/simulation';
import { Store } from '../../packages/chrome/src/store';
import type { GameSession, UiState } from '../../apps/web/src/state/session';
import { ToolController } from '../../apps/web/src/tools/controller';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => vi.unstubAllGlobals());
function frame() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}
function setup(ruleset: Ruleset = 'oasis') {
  const engine = createEngine({
    seed: 'tool-input',
    size: 32,
    ruleset,
    funds: 100_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  const ui = new Store<
    Pick<
      UiState,
      | 'tool'
      | 'hover'
      | 'preview'
      | 'underground'
      | 'constructionFeedback'
      | 'cityRevision'
      | 'screen'
    >
  >({
    tool: 'canal',
    hover: { x: 4, y: 4 },
    preview: null,
    underground: false,
    constructionFeedback: null,
    cityRevision: 1,
    screen: 'game',
  });
  const client = {
    world: engine.world,
    buildings: engine.buildings,
    stats: engine.stats(),
    command: vi.fn(async (command: Command) => engine.execute(command)),
  };
  const renderer = { setHighlight: vi.fn(), setPlacementPreview: vi.fn() };
  const onBuilt = vi.fn();
  const notifyReason = vi.fn();
  const tools = new ToolController({
    ui,
    client,
    renderer,
    notifyReason,
    onBuilt,
    select: vi.fn(),
    setUnderground: (underground: boolean) => ui.set({ underground }),
  } as unknown as GameSession);
  return { engine, ui, client, renderer, tools, onBuilt, notifyReason };
}

describe('construction input', () => {
  it('keeps the completed building clear of ghosts until the next target or attempt', async () => {
    const { tools, renderer, client, engine } = setup();
    tools.setTool('fireStation');
    tools.onPointer('down', { x: 4, y: 4 });
    await Promise.resolve();
    client.stats = engine.stats();
    tools.refreshCurrent();
    frame();
    expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(null);
    tools.refreshCurrent();
    frame();
    expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(null);
    tools.onHover({ x: 8, y: 8 });
    frame();
    expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'fireStation', ok: true }),
    );
    tools.onPointer('down', { x: 4, y: 4 });
    await Promise.resolve();
    frame();
    expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'fireStation', ok: false }),
    );
  });

  it('distinguishes existing lots from the actual changes and cost in a partial drag', () => {
    const { tools, ui, engine, client } = setup();
    const first = engine.execute({ type: 'canal', x0: 4, y0: 4, x1: 4, y1: 4 });
    client.stats = engine.stats();
    const before = hashState(engine);
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('move', { x: 6, y: 4 });
    frame();
    expect(ui.get().preview).toMatchObject({
      ok: true,
      count: 2,
      skipped: 1,
      unchanged: 1,
      dragging: true,
      cost: first.cost * 2,
    });
    expect(hashState(engine)).toBe(before);
  });

  it.each(['oasis', 'classic'] as const)(
    'keeps placement silhouettes scoped to %s presentation',
    (ruleset) => {
      const { tools, renderer } = setup(ruleset);
      tools.setTool('fireStation');
      frame();
      if (ruleset === 'oasis')
        expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ kind: 'fireStation', ok: true }),
        );
      else expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(null);
      tools.cancel();
      expect(renderer.setPlacementPreview).toHaveBeenLastCalledWith(null);
    },
  );

  it('uses the worker receipt even after selecting another tool', async () => {
    const { tools, ui, client } = setup();
    let reply!: (result: CommandResult) => void;
    client.command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('up', { x: 6, y: 4 });
    expect(ui.get().constructionFeedback).toMatchObject({ phase: 'pending', tool: 'canal' });
    tools.setTool('road');
    const actual = { ok: true, cost: 5, applied: 1, skipped: 2 };
    reply(actual);
    await Promise.resolve();
    expect(ui.get().constructionFeedback).toMatchObject({
      phase: 'complete',
      tool: 'canal',
      result: actual,
    });
  });

  it.each(['city', 'menu'] as const)(
    'drops delayed results after changing the %s',
    async (change) => {
      const { tools, ui, client, onBuilt, notifyReason } = setup();
      let reply!: (result: CommandResult) => void;
      client.command.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            reply = resolve;
          }),
      );
      tools.onPointer('down', { x: 4, y: 4 });
      tools.onPointer('up', { x: 4, y: 4 });
      ui.set(
        change === 'city'
          ? { cityRevision: 2, constructionFeedback: null }
          : { screen: 'menu', constructionFeedback: null },
      );
      reply({ ok: true, cost: 5, applied: 1, skipped: 0 });
      await Promise.resolve();
      expect(ui.get().constructionFeedback).toBeNull();
      expect(onBuilt).not.toHaveBeenCalled();
      expect(notifyReason).not.toHaveBeenCalled();
    },
  );

  it('does not let an older response replace a newer receipt', async () => {
    const { tools, ui, client } = setup();
    let first!: (result: CommandResult) => void;
    client.command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    );
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('up', { x: 4, y: 4 });
    tools.onPointer('down', { x: 5, y: 4 });
    tools.onPointer('up', { x: 5, y: 4 });
    await Promise.resolve();
    const latest = ui.get().constructionFeedback;
    first({ ok: false, cost: 0, applied: 0, skipped: 1, reason: RejectReason.Occupied });
    await Promise.resolve();
    expect(ui.get().constructionFeedback).toEqual(latest);
  });

  it('shows an unconfirmed result after a transport failure and keeps classic receipts absent', async () => {
    const { tools, ui, client } = setup();
    client.command.mockRejectedValueOnce(new Error('Worker unavailable'));
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('up', { x: 4, y: 4 });
    await Promise.resolve();
    expect(ui.get().constructionFeedback).toMatchObject({ phase: 'failed' });
    const classic = setup('classic');
    classic.tools.setTool('road');
    classic.tools.onPointer('down', { x: 4, y: 4 });
    classic.tools.onPointer('up', { x: 4, y: 4 });
    await Promise.resolve();
    expect(classic.ui.get().constructionFeedback).toBeNull();
  });

  it.each(['oasis', 'classic'] as const)('previews canals using the %s ruleset', (ruleset) => {
    const { engine, ui, tools } = setup(ruleset);
    const before = hashState(engine);
    tools.refreshCurrent();
    frame();
    expect(ui.get().preview?.ok).toBe(ruleset === 'oasis');
    if (ruleset === 'classic') expect(ui.get().preview?.reason).toBe(RejectReason.Invalid);
    expect(hashState(engine)).toBe(before);
  });

  it('draws only the latest hover once per frame using the latest funds', () => {
    const { tools, ui, client, renderer } = setup();
    for (let i = 0; i < 100; i++) tools.onHover({ x: 2 + (i % 10), y: 4 });
    expect(renderer.setHighlight).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    client.stats = { ...client.stats, funds: 0 };
    frame();
    expect(renderer.setHighlight).toHaveBeenCalledTimes(1);
    expect(renderer.setHighlight).toHaveBeenLastCalledWith([{ x: 11, y: 4, state: 'bad' }]);
    expect(ui.get().preview?.reason).toBe(RejectReason.InsufficientFunds);
    client.stats = { ...client.stats, funds: 100_000 };
    ui.set({ hover: { x: 11, y: 4 } });
    tools.refreshCurrent();
    frame();
    expect(ui.get().preview?.ok).toBe(true);
  });

  it('commits the release endpoint even before a preview frame or another move', () => {
    const { tools, client, engine } = setup();
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('move', { x: 5, y: 4 });
    tools.onPointer('up', { x: 8, y: 4 });
    expect(client.command).toHaveBeenCalledExactlyOnceWith({
      type: 'canal',
      x0: 4,
      y0: 4,
      x1: 8,
      y1: 4,
    });
    for (let x = 4; x <= 8; x++)
      expect(engine.world.infra[engine.world.index(x, 4)]! & Infra.Canal).toBeTruthy();
  });

  it.each(['cancel', 'outside'] as const)('never commits an interrupted drag: %s', (end) => {
    const { tools, client, ui, engine } = setup();
    const before = hashState(engine);
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('move', { x: 8, y: 4 });
    if (end === 'cancel') tools.cancel();
    else tools.onPointer('up', null);
    frame();
    tools.onPointer('up', { x: 9, y: 4 });
    expect(client.command).not.toHaveBeenCalled();
    expect(ui.get().preview).toBeNull();
    expect(hashState(engine)).toBe(before);
  });

  it('replaces queued previews when switching tools and clears unavailable worlds', () => {
    const { tools, ui, renderer, client } = setup();
    tools.onPointer('down', { x: 4, y: 4 });
    tools.onPointer('move', { x: 8, y: 4 });
    tools.setTool('road');
    renderer.setHighlight.mockClear();
    frame();
    expect(renderer.setHighlight).toHaveBeenCalledExactlyOnceWith([{ x: 4, y: 4, state: 'ok' }]);
    expect(ui.get().preview?.count).toBe(1);
    client.stats = null as unknown as typeof client.stats;
    tools.refreshCurrent();
    frame();
    expect(ui.get().preview).toBeNull();
  });
});
