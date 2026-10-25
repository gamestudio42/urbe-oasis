/**
 * Rendering, memory and long-session check of the Urbe Oasis production build in real browsers.
 *
 *   pnpm build && pnpm bench:render                    # chromium, firefox and webkit if installed
 *   pnpm bench:render --browsers chromium --session 600 # one browser, ten-minute session
 *
 * For each browser and city it measures frame intervals (requestAnimationFrame) while idle,
 * panning, zoomed in on street life and on the zoomed-out overview, then runs the city at full
 * speed and samples heap (where the browser reports it) and renderer counts. A count that keeps
 * growing in a steady city points to a leak.
 *
 * Headless browsers render through software, so the frame numbers compare builds and views on
 * one machine; they are not a measure of fluidity on a player's GPU.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserType,
  type Page,
} from '@playwright/test';
import { encodeSave, OASIS_SAVE_FORMAT, TICKS_PER_MONTH } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';

const { values } = parseArgs({
  options: {
    browsers: { type: 'string', default: 'chromium,firefox,webkit' },
    port: { type: 'string', default: '5191' },
    url: { type: 'string' },
    /** Seconds of each frame-time view. */
    view: { type: 'string', default: '8' },
    /** Seconds of the full-speed session. */
    session: { type: 'string', default: '180' },
    out: { type: 'string', default: 'reports/render/render-benchmark.json' },
    /** Comma-separated city ids to run (all by default). */
    cities: { type: 'string' },
    /** `off` isolates the simulation and static drawing from cars, smoke and street life. */
    animations: { type: 'string', default: 'on' },
    /** Simulation speed during the frame-time views (0 isolates rendering from the worker). */
    'view-speed': { type: 'string', default: '1' },
    /** Open a visible window on the machine's GPU instead of headless software rendering. */
    headed: { type: 'boolean', default: false },
  },
});

const ENGINES: Record<string, BrowserType> = { chromium, firefox, webkit };
const VIEW_SECONDS = Number(values.view);
const SESSION_SECONDS = Number(values.session);
const SAMPLE_SECONDS = 30;
const JANK_MS = 33.4;

interface CitySpec {
  id: string;
  preset: string;
  seed: string;
  size: number;
  months: number;
}

const ALL_CITIES: CitySpec[] = [
  { id: 'journey-64', preset: 'oasis-journey', seed: '3', size: 64, months: 48 },
  { id: 'balanced-128', preset: 'oasis-balanced', seed: '1', size: 128, months: 60 },
];

const CITIES = values.cities
  ? ALL_CITIES.filter((c) => values.cities!.split(',').includes(c.id))
  : ALL_CITIES;

/** A grown city as an Oasis save, built headlessly with the same automated players as `pnpm sim`. */
function citySave(spec: CitySpec): { text: string; population: number } {
  const run = SIM_PRESETS[spec.preset]!.create(spec.seed, spec.size);
  for (let m = 0; m < spec.months; m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  const population = run.engine.stats().population;
  const text = JSON.stringify(
    encodeSave(
      run.engine.serialize(),
      { population, funds: run.engine.economy.funds, savedAt: new Date(0).toISOString() },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  return { text, population };
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

function summarize(intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const total = intervals.reduce((a, b) => a + b, 0);
  return {
    frames: intervals.length,
    fps: round(intervals.length ? (1000 * intervals.length) / total : 0, 1),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted.at(-1) ?? 0),
    jank: round(intervals.filter((v) => v > JANK_MS).length / Math.max(1, intervals.length), 3),
  };
}

/**
 * Frame intervals for `seconds`; panning circles the camera around `centre`. The loop is sent as
 * source text: tsx would wrap a named function in a helper that does not exist in the page.
 */
async function frames(
  page: Page,
  seconds: number,
  pan: boolean,
  centre: number,
): Promise<number[]> {
  return page.evaluate(`new Promise((resolve) => {
    const out = [];
    const start = performance.now();
    let last = start;
    function step(now) {
      out.push(now - last);
      last = now;
      if (${pan}) {
        const t = (now - start) / 1000;
        window.__cityDebug.centerOnTile(
          Math.round(${centre} + ${centre / 2} * Math.cos(t * 0.6)),
          Math.round(${centre} + ${centre / 2} * Math.sin(t * 0.6)),
        );
      }
      if (now - start < ${seconds * 1000}) requestAnimationFrame(step);
      else resolve(out.slice(1));
    }
    requestAnimationFrame(step);
  })`);
}

async function heap(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null;
  });
}

async function measureCity(page: Page, city: CitySpec, save: string) {
  await page.goto(values.url ?? `http://localhost:${values.port}/`);
  await page.getByTestId('main-menu').waitFor({ timeout: 60_000 });
  const loaded = await page.evaluate((text) => window.__cityDebug!.importText(text), save);
  if (!loaded.ok) throw new Error(`Could not load ${city.id}`);
  await page.waitForFunction(() => window.__cityDebug?.isReady(), null, { timeout: 60_000 });
  await page.addStyleTag({
    content: '.oasis-guide,.oasis-chronicle,.toasts{display:none!important}',
  });
  const centre = Math.floor(city.size / 2);
  const view = async (zoom: number, pan: boolean) => {
    await page.evaluate(
      ({ zoom, centre, speed }) => {
        window.__cityDebug!.centerOnTile(centre, centre);
        window.__cityDebug!.setZoom(zoom);
        window.__cityDebug!.setSpeed(speed as 0 | 1 | 2 | 3);
      },
      { zoom, centre, speed: Number(values['view-speed']) },
    );
    await page.waitForTimeout(1500);
    const result = summarize(await frames(page, VIEW_SECONDS, pan, centre));
    const animation = await page.evaluate(() => window.__cityDebug!.animationStats());
    const render = await page.evaluate(() => window.__cityDebug!.renderStats());
    return { ...result, walkers: animation.walkers, cars: animation.cars, ...render };
  };
  const views = {
    idle: await view(1, false),
    pan: await view(1, true),
    street: await view(2.4, false),
    overview: await view(0.5, false),
  };

  await page.evaluate((centre) => {
    window.__cityDebug!.centerOnTile(centre, centre);
    window.__cityDebug!.setZoom(1.2);
    window.__cityDebug!.setSpeed(3);
  }, centre);
  const session: Array<Record<string, number | null>> = [];
  const started = Date.now();
  for (let t = 0; t <= SESSION_SECONDS; t += SAMPLE_SECONDS) {
    if (t > 0) await page.waitForTimeout(SAMPLE_SECONDS * 1000);
    const render = await page.evaluate(() => window.__cityDebug!.renderStats());
    const stats = await page.evaluate(() => window.__cityDebug!.getStats()!);
    session.push({
      seconds: Math.round((Date.now() - started) / 1000),
      heapMB: await heap(page),
      fps: round(await page.evaluate(() => window.__cityDebug!.fps()), 1),
      displayObjects: render.displayObjects,
      textures: render.textures,
      population: stats.population,
      month: Math.floor(stats.tick / TICKS_PER_MONTH),
    });
  }
  return { views, session };
}

async function runBrowser(name: string, saves: Map<string, string>) {
  const type = ENGINES[name];
  if (!type) return { browser: name, skipped: 'unknown browser' };
  let browser: Browser;
  try {
    browser = await type.launch(
      values.headed
        ? {
            headless: false,
            ...(name === 'chromium' ? { args: ['--enable-precise-memory-info'] } : {}),
          }
        : name === 'chromium'
          ? { args: ['--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader'] }
          : {},
    );
  } catch (error) {
    return { browser: name, skipped: `not available: ${(error as Error).message.split('\n')[0]}` };
  }
  const result: Record<string, unknown> = {
    browser: name,
    version: browser.version(),
    mode: values.headed ? 'headed (GPU)' : 'headless (software)',
  };
  try {
    for (const city of CITIES) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.addInitScript((animations) => {
        localStorage.setItem('cityBuilder.locale', 'en');
        localStorage.setItem('oasis.tutorial.founding.v1', '1');
        localStorage.setItem('cityBuilder.animations', animations === 'off' ? '0' : '1');
      }, values.animations);
      console.log(`${name}: ${city.id}`);
      result[city.id] = await measureCity(page, city, saves.get(city.id)!);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return result;
}

async function startPreview(): Promise<ChildProcess | null> {
  if (values.url) return null;
  const server = spawn(
    'pnpm',
    ['--filter', '@oasis/web', 'preview', '--port', values.port, '--strictPort'],
    { stdio: 'ignore' },
  );
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${values.port}/`);
      if (response.ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error('The preview server did not start; run pnpm build first.');
}

const saves = new Map<string, string>();
const populations: Record<string, number> = {};
for (const city of CITIES) {
  const { text, population } = citySave(city);
  saves.set(city.id, text);
  populations[city.id] = population;
}
const server = await startPreview();
const results = [];
try {
  for (const name of values.browsers
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean))
    results.push(await runBrowser(name, saves));
} finally {
  server?.kill();
}
const report = {
  date: new Date().toISOString(),
  viewSeconds: VIEW_SECONDS,
  sessionSeconds: SESSION_SECONDS,
  cities: CITIES.map((c) => ({ ...c, population: populations[c.id] })),
  results,
};
mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out, JSON.stringify(report, null, 2));
for (const r of results) {
  if ('skipped' in r) {
    console.log(`${r.browser}: skipped (${r.skipped})`);
    continue;
  }
  for (const city of CITIES) {
    const data = (r as Record<string, unknown>)[city.id] as
      | {
          views: Record<string, ReturnType<typeof summarize>>;
          session: Array<Record<string, number | null>>;
        }
      | undefined;
    if (!data) continue;
    const rows = Object.entries(data.views).map(
      ([view, v]) => `${view} p50 ${v.p50} p95 ${v.p95} jank ${v.jank}`,
    );
    const first = data.session[0];
    const last = data.session.at(-1);
    console.log(`${r.browser} ${city.id}: ${rows.join(' | ')}`);
    console.log(
      `  session: heap ${first?.heapMB ?? 'n/a'} -> ${last?.heapMB ?? 'n/a'} MB, objects ${first?.displayObjects} -> ${last?.displayObjects}, textures ${first?.textures} -> ${last?.textures}`,
    );
  }
}
console.log(`report: ${values.out}`);
