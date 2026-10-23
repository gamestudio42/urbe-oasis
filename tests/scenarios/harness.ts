import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectMetrics,
  hashState,
  type MonthMetrics,
  type SimulationEngine,
} from '@city/simulation';
import { expect } from 'vitest';

const REPORTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../reports/scenarios');

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** A named simulation run that records monthly metrics and trend checks into a JSON report. */
export class Scenario {
  readonly metrics: MonthMetrics[] = [];
  readonly checks: Check[] = [];

  constructor(
    readonly name: string,
    readonly engine: SimulationEngine,
  ) {}

  /** Simulates `months` months, sampling metrics after each one. */
  run(months: number, onMonth?: (engine: SimulationEngine, month: number) => void): this {
    for (let m = 0; m < months; m++) {
      const start = performance.now();
      this.engine.runMonths(1);
      const metrics = collectMetrics(this.engine);
      metrics.msPerMonth = Math.round((performance.now() - start) * 100) / 100;
      this.metrics.push(metrics);
      onMonth?.(this.engine, m);
    }
    return this;
  }

  get last(): MonthMetrics {
    const last = this.metrics.at(-1);
    if (!last) throw new Error(`Scenario ${this.name} has not run yet`);
    return last;
  }

  /** Metrics sampled `monthsAgo` months before the last sample. */
  at(monthsAgo: number): MonthMetrics {
    const m = this.metrics[this.metrics.length - 1 - monthsAgo];
    if (!m) throw new Error(`Scenario ${this.name} has no sample ${monthsAgo} months ago`);
    return m;
  }

  check(name: string, ok: boolean, detail: string | number = ''): boolean {
    this.checks.push({ name, ok, detail: String(detail) });
    return ok;
  }

  /** Writes `reports/scenarios/<name>.json` and fails the test if any check failed. */
  finish(extra: Record<string, unknown> = {}): void {
    mkdirSync(REPORTS_DIR, { recursive: true });
    const report = {
      scenario: this.name,
      seed: this.engine.seed,
      size: this.engine.world.size,
      months: this.metrics.length,
      hash: hashState(this.engine),
      passed: this.checks.every((c) => c.ok),
      checks: this.checks,
      ...extra,
      metrics: this.metrics,
    };
    writeFileSync(
      resolve(REPORTS_DIR, `${this.name}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    expect(this.checks.filter((c) => !c.ok)).toEqual([]);
  }
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
