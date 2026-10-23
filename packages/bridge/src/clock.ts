export const DEFAULT_FRAME_MS = 50;
export const DEFAULT_MAX_TICKS_PER_FRAME = 40;

/** Converts wall-clock time into a whole number of simulation ticks. */
export class WorkerClock {
  speed = 1;
  accumulator = 0;
  lastTime = 0;

  constructor(
    private readonly ticksPerSecond: readonly number[],
    private readonly maxTicksPerFrame = DEFAULT_MAX_TICKS_PER_FRAME,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.lastTime = this.now();
  }

  reset(): void {
    this.accumulator = 0;
    this.lastTime = this.now();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.accumulator = 0;
  }

  /** Ticks to run this frame (0 when paused or when less than one tick has elapsed). */
  takeTicks(): number {
    const now = this.now();
    const elapsed = now - this.lastTime;
    this.lastTime = now;
    const rate = this.ticksPerSecond[this.speed] ?? 0;
    if (rate === 0) {
      this.accumulator = 0;
      return 0;
    }
    this.accumulator += (elapsed * rate) / 1000;
    const ticks = Math.min(this.maxTicksPerFrame, Math.floor(this.accumulator));
    this.accumulator = Math.min(this.accumulator - ticks, this.maxTicksPerFrame);
    return ticks;
  }
}

export function startFixedStep(
  clock: WorkerClock,
  onTicks: (ticks: number) => void,
  frameMs = DEFAULT_FRAME_MS,
): () => void {
  const id = setInterval(() => {
    const ticks = clock.takeTicks();
    if (ticks > 0) onTicks(ticks);
  }, frameMs);
  return () => clearInterval(id);
}
