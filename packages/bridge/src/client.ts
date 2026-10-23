import { emitListeners, RpcInbox } from './rpc';

export interface WorkerPort<TTo, TFrom> {
  postMessage(message: TTo): void;
  onmessage: ((event: MessageEvent<TFrom>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/**
 * Thin main-thread wrapper around a simulation worker: send, RPC, init waiters, listeners.
 */
export class SimClient<TTo, TFrom, TListener extends object> {
  readonly rpc = new RpcInbox<TFrom>();
  protected readonly listeners = new Set<TListener>();

  constructor(protected readonly worker: WorkerPort<TTo, TFrom>) {
    this.worker.onmessage = (event) => this.handle(event.data);
    this.worker.onerror = (event) => this.onWorkerError(event.message || 'Worker failed');
  }

  subscribe(listener: TListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: TTo): void {
    this.worker.postMessage(message);
  }

  request<T>(
    message: TTo & { id: number },
    pick: (m: TFrom) => T | undefined,
  ): Promise<T> {
    return this.rpc.request((id) => this.send({ ...message, id }), pick);
  }

  waitInit(start: () => void): Promise<void> {
    return this.rpc.waitInit(start);
  }

  dispose(): void {
    this.worker.terminate();
  }

  protected emit(key: keyof TListener, ...args: unknown[]): void {
    emitListeners(this.listeners, key, ...args);
  }

  protected handle(_message: TFrom): void {
    // Subclasses route init / delta / RPC replies.
  }

  protected onWorkerError(_message: string): void {
    // Subclasses surface worker failures (demo boot, toasts).
  }
}
