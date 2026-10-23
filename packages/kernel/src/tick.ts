/** A custom system run every tick after the built-in pipeline. */
export interface System<TEngine> {
  readonly id: string;
  update(engine: TEngine): void;
}

/** FIFO of player commands applied at the start of a tick. */
export class CommandQueue<TCommand> {
  private readonly items: TCommand[] = [];

  get length(): number {
    return this.items.length;
  }

  enqueue(command: TCommand): void {
    this.items.push(command);
  }

  drain(apply: (command: TCommand) => void): void {
    while (this.items.length > 0) apply(this.items.shift() as TCommand);
  }
}

export function runSystems<TEngine>(systems: readonly System<TEngine>[], engine: TEngine): void {
  for (const system of systems) system.update(engine);
}

export function runTicks(count: number, step: () => void): void {
  for (let i = 0; i < count; i++) step();
}
