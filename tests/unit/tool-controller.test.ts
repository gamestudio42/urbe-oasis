import { Infra, RejectReason, type Command, type Ruleset } from '@city/shared';
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
  const ui = new Store<Pick<UiState, 'tool' | 'hover' | 'preview' | 'underground'>>({
    tool: 'canal',
    hover: { x: 4, y: 4 },
    preview: null,
    underground: false,
  });
  const client = {
    world: engine.world,
    buildings: engine.buildings,
    stats: engine.stats(),
    command: vi.fn(async (command: Command) => engine.execute(command)),
  };
  const renderer = { setHighlight: vi.fn() };
  const tools = new ToolController({
    ui,
    client,
    renderer,
    notifyReason: vi.fn(),
    onBuilt: vi.fn(),
    select: vi.fn(),
    setUnderground: (underground: boolean) => ui.set({ underground }),
  } as unknown as GameSession);
  return { engine, ui, client, renderer, tools };
}

describe('construction input', () => {
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
