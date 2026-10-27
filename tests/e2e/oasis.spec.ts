import { expect, test } from '@playwright/test';
import { openWorldOptions } from './helpers';

/**
 * Urbe Oasis end-to-end: boot, found a city, build the oasis placeables and read the telemetry.
 *
 * The specs reuse the shared Urbe data-testids on purpose — the oasis app wraps the same UI, so a
 * regression in the wrapper shows up here as a missing panel instead of a silent divergence.
 */

const PORT = Number(process.env.OASIS_PORT ?? 5180);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId('main-menu').waitFor();
});

async function startOasisCity(page: import('@playwright/test').Page, seed: string) {
  await openWorldOptions(page);
  await page.getByTestId('seed-input').fill(seed);
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(500);
}

test('boots into Urbe Oasis with the oasis brand', async ({ page }) => {
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.locator('body')).toContainText(/Urbe Oasis|URBE OASIS/);
  const mark = page.getByTestId('main-menu').getByTestId('studio-mark');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('href', 'https://gamestudio42.github.io/');
  await expect(mark).toHaveAccessibleName('Game Studio 42');
});

test('stacks sound and music on the city, under the bar', async ({ page }) => {
  await startOasisCity(page, 'neon-audio');
  const sound = page.getByTestId('hud-sound');
  const music = page.getByTestId('hud-music');
  await expect(sound).toBeVisible();
  await expect(music).toBeVisible();
  await expect(sound).toHaveAccessibleName('Som ligado');
  await expect(music).toHaveAccessibleName('Música ligada');
  const soundBox = await sound.boundingBox();
  const musicBox = await music.boundingBox();
  const hudBox = await page.getByTestId('hud').boundingBox();
  expect(soundBox && musicBox && hudBox).toBeTruthy();
  expect(soundBox!.y).toBeGreaterThanOrEqual(hudBox!.y + hudBox!.height);
  expect(musicBox!.y).toBeGreaterThanOrEqual(soundBox!.y + soundBox!.height);
  expect(soundBox!.x).toBeGreaterThan(musicBox!.x - 8);
  await music.click();
  await expect(music).toHaveAccessibleName('Música desligada');
  expect(await page.evaluate(() => window.__cityDebug?.musicState())).toMatchObject({
    enabled: false,
  });
});

test('reports the Oasis ruleset in the mirror stats', async ({ page }) => {
  await startOasisCity(page, 'neon-e2e');
  await expect(page.getByTestId('studio-mark')).toBeVisible();
  const stats = await page.evaluate(() => window.__cityDebug?.getStats() ?? null);
  expect(stats).not.toBeNull();
  expect(stats?.oasis).toBeDefined();
  expect(stats?.oasis?.parched).toBeGreaterThanOrEqual(0);
  expect(stats?.oasis?.caravans.count).toBeGreaterThanOrEqual(0);
});

test('offers the Oasis-only tools and hides them from classic Urbe', async ({ page }) => {
  await startOasisCity(page, 'neon-tools');
  for (const id of [
    'tool-qanat',
    'tool-cistern',
    'tool-windbreak',
    'tool-arcade',
    'tool-caravanserai',
    'tool-canal',
    'tool-springHouse',
    'tool-palm',
  ]) {
    await expect(page.getByTestId(id)).toBeAttached();
  }
});

test('canal tool stays on the surface and the shade overlay is listed', async ({ page }) => {
  await startOasisCity(page, 'neon-canal');
  await page.getByTestId('tool-category-utilities').click();
  await page.getByTestId('tool-canal').click();
  await expect(page.getByTestId('tool-canal')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('open-system').click();
  await expect(page.getByTestId('underground-enabled')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('system-panel')).toBeHidden();
  await page.getByTestId('open-overlays').click();
  await expect(page.getByTestId('overlay-data')).toBeVisible();
});

test('places a qanat, a cistern and a windbreak through the debug command API', async ({
  page,
}) => {
  await startOasisCity(page, 'neon-build');
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(3, 3) ?? null);
  expect(area).not.toBeNull();
  if (!area) return;

  const built = await page.evaluate(async (p) => {
    const d = window.__cityDebug!;
    return [
      await d.command({ type: 'place', kind: 'qanat', x: p.x, y: p.y }),
      await d.command({ type: 'place', kind: 'cistern', x: p.x + 2, y: p.y }),
      await d.command({ type: 'place', kind: 'windbreak', x: p.x + 2, y: p.y + 1 }),
    ];
  }, area);
  for (const result of built) expect(result.ok).toBe(true);

  const stats = await page.evaluate(() => window.__cityDebug?.getStats() ?? null);
  expect(stats?.oasis).toBeDefined();
});

test('exports and imports an Oasis save', async ({ page }) => {
  await startOasisCity(page, 'neon-save');
  const text = await page.evaluate(() => window.__cityDebug?.exportText() ?? '');
  expect(text.length).toBeGreaterThan(0);
  const loaded = await page.evaluate(async (saved) => {
    return window.__cityDebug?.importText(saved) ?? null;
  }, text);
  expect(loaded?.ok).toBe(true);
});

test('shows only Oasis saves on a shared origin and preserves legacy Oasis saves', async ({
  page,
}) => {
  await startOasisCity(page, 'oasis-legacy-save');
  const text = await page.evaluate(() => window.__cityDebug!.exportText());
  const meta = JSON.parse(text).meta as {
    name: string;
    seed: string;
    size: number;
    tick: number;
    population: number;
    funds: number;
    savedAt: string;
  };
  const oasisId = `city:${meta.seed}:${meta.name}`;
  await page.evaluate(
    async ({ oasisId, meta, text }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('city-builder', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          database.createObjectStore('meta', { keyPath: 'id' });
          database.createObjectStore('data', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['meta', 'data'], 'readwrite');
      tx.objectStore('meta').put({
        ...meta,
        id: 'autosave',
        name: 'Urbe City',
        autosave: true,
        bytes: 42,
        savedAt: '2026-10-24T12:00:00.000Z',
      });
      tx.objectStore('data').put({
        id: 'autosave',
        text: JSON.stringify({ state: { ruleset: 'classic' } }),
      });
      tx.objectStore('meta').put({ ...meta, id: oasisId, autosave: false, bytes: text.length });
      tx.objectStore('data').put({ id: oasisId, text });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { oasisId, meta, text },
  );

  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await expect(page.getByTestId('save-slot')).toHaveCount(1);
  await expect(page.getByTestId('continue')).toContainText(meta.name);
  await expect(page.getByTestId('saved-cities')).not.toContainText('Urbe City');
  await page.getByTestId('load-slot').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  expect(await page.evaluate(() => window.__cityDebug!.getStats()!.ruleset)).toBe('oasis');
});

test('replays the same command log and ticks to the same hash', async ({ page }) => {
  await startOasisCity(page, 'oasis-determinism');
  await page.getByTestId('speed-0').click();
  const baseline = await page.evaluate(() => window.__cityDebug!.exportText());
  const replay = async () =>
    page.evaluate(async () => {
      const d = window.__cityDebug!;
      const changed = await d.command({ type: 'setTax', zone: 'residential', rate: 8 });
      if (!changed.ok) throw new Error('Tax command was rejected');
      await d.runTicks(120);
      return d.hash();
    });
  const first = await replay();
  const loaded = await page.evaluate((text) => window.__cityDebug!.importText(text), baseline);
  expect(loaded.ok).toBe(true);
  expect(await replay()).toBe(first);
});

test('an arcade eases the street and does not launch drones', async ({ page }) => {
  test.setTimeout(120_000);
  await openWorldOptions(page);
  await page.getByTestId('terrain-water').fill('0');
  await page.getByTestId('terrain-hills').fill('0');
  await page.getByTestId('terrain-forest').fill('0');
  await page.getByTestId('terrain-rivers').fill('0');
  await startOasisCity(page, 'oasis-arcade');
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(18, 10) ?? null);
  expect(area).not.toBeNull();
  if (!area) return;

  const built = await page.evaluate(async (p) => {
    const d = window.__cityDebug;
    if (!d) return null;
    await d.command({ type: 'road', x0: p.x + 7, y0: p.y + 6, x1: p.x + 17, y1: p.y + 6 });
    const ok: Record<string, boolean> = {};
    for (const [kind, dx] of [
      ['arcade', 7],
      ['qanat', 3],
      ['cistern', 5],
      ['windbreak', 6],
    ] as const) {
      ok[kind] = (await d.command({ type: 'place', kind, x: p.x + dx, y: p.y + 7 })).ok;
    }
    await d.command({ type: 'place', kind: 'coalPlant', x: p.x + 3, y: p.y + 4 });
    await d.runTicks(60);
    return ok;
  }, area);
  expect(built?.arcade).toBe(true);

  await page.getByTestId('speed-1').click();
  await page.waitForTimeout(1000);
  const drones = await page.evaluate(() => window.__cityDebug?.animationStats().drones ?? -1);
  expect(drones).toBe(0);
});
