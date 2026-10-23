/**
 * Main-thread inbox for worker RPCs keyed by `id`, plus waiters for the next `init`.
 */
export class RpcInbox<TFrom> {
  private nextId = 1;
  private readonly pending = new Map<number, (message: TFrom) => void>();
  private initResolvers: Array<() => void> = [];

  addInit(resolve: () => void): void {
    this.initResolvers.push(resolve);
  }

  waitInit(start: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.addInit(resolve);
      start();
    });
  }

  resolveInit(): void {
    const resolvers = this.initResolvers;
    this.initResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  dropInit(settle: () => void): void {
    this.initResolvers = this.initResolvers.filter((resolve) => resolve !== settle);
  }

  request<T>(send: (id: number) => void, pick: (message: TFrom) => T | undefined): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, (message) => resolve(pick(message) as T));
      send(id);
    });
  }

  settle(id: number, message: TFrom): boolean {
    const resolve = this.pending.get(id);
    if (!resolve) return false;
    this.pending.delete(id);
    resolve(message);
    return true;
  }
}

export function emitListeners<T extends object>(
  listeners: Iterable<T>,
  key: keyof T,
  ...args: unknown[]
): void {
  for (const listener of listeners) {
    const fn = listener[key] as ((...a: unknown[]) => void) | undefined;
    fn?.(...args);
  }
}
