import { encodeSave, Terrain, type Command } from '@city/shared';
import { addServices, buildTown, flatCity, maintainTown } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';
import { clickTile, clientPointOf, startCity, waitForCity } from './helpers';

/** A town of ~2,200 people on a southern coast with an airport and two marinas. */
function hubCitySave(): string {
  const e = flatCity('hubs-e2e', 64, 200_000);
  addServices(e, buildTown(e, { pumps: 8 }));
  const w = e.world;
  for (let y = 56; y < 64; y++) {
    for (let x = 0; x < 64; x++) w.terrain[w.index(x, y)] = Terrain.Water;
  }
  w.terrainVersion++;
  const run = (c: Command) => {
    const r = e.execute(c);
    if (!r.ok) throw new Error(`${c.type} failed: ${r.reason ?? ''}`);
  };
  run({ type: 'road', x0: 20, y0: 29, x1: 20, y1: 60 });
  run({ type: 'road', x0: 8, y0: 52, x1: 44, y1: 52 });
  for (let m = 0; m < 120 && e.stats().population < 2200; m++) {
    e.runMonths(1);
    maintainTown(e);
  }
  run({ type: 'place', kind: 'windTurbine', x: 19, y: 54 });
  run({ type: 'place', kind: 'airport', x: 21, y: 40 });
  run({ type: 'place', kind: 'windTurbine', x: 25, y: 40 });
  run({ type: 'place', kind: 'marina', x: 12, y: 53 });
  run({ type: 'place', kind: 'marina', x: 30, y: 53 });
  run({ type: 'road', x0: 29, y0: 52, x1: 29, y1: 55 });
  run({ type: 'place', kind: 'windTurbine', x: 15, y: 53 });
  run({ type: 'place', kind: 'windTurbine', x: 33, y: 53 });
  e.runMonths(1);
  for (const b of e.buildings.values()) {
    if ((b.kind === 'airport' || b.kind === 'marina') && !b.powered) {
      throw new Error(`${b.kind} at ${b.x},${b.y} is not powered`);
    }
  }
  const s = e.stats();
  const file = encodeSave(e.serialize(), {
    population: s.population,
    funds: s.funds,
    savedAt: '2026-01-01T00:00:00.000Z',
  });
  return JSON.stringify(file);
}

const stats = (page: Page) => page.evaluate(() => window.__cityDebug?.animationStats());

test('marinas send boats out and the airport flies planes', async ({ page }) => {
  test.setTimeout(120_000);
  const save = hubCitySave();
  await startCity(page, 'hubs', { size: 64 });
  const loaded = await page.evaluate((text) => window.__cityDebug?.importText(text), save);
  expect(loaded?.ok).toBe(true);
  await waitForCity(page);
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));

  // The inspector tells what the airport does for the city.
  await clientPointOf(page, 22, 41);
  await clickTile(page, 22, 41);
  await expect(page.getByTestId('inspector')).toBeVisible();
  await expect(page.getByTestId('hub-status')).toContainText('Em operação');
  await expect(page.getByTestId('hub-jobs')).toContainText(/\d/);
  await expect(page.getByTestId('hub-regional')).toContainText('Ativa');
  await page.screenshot({ path: 'test-results/hubs-inspector.png' });
  await page.keyboard.press('Escape');

  // Boats sit in their own layer under the road/bridge deck.
  expect(await page.evaluate(() => window.__cityDebug?.chunkStack())).toEqual([
    'ground',
    'water',
    'boats',
    'roads',
    'overlay',
    'vehicles',
    'objects',
    'wires',
  ]);

  // At 1× boats leave the marinas and a plane uses the runway.
  await clientPointOf(page, 24, 50);
  await page.getByTestId('speed-1').click();
  await expect.poll(async () => (await stats(page))?.boats ?? 0).toBeGreaterThan(0);
  await expect.poll(async () => (await stats(page))?.planes ?? 0).toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  await clientPointOf(page, 20, 58);
  await page.screenshot({ path: 'test-results/hubs-bridge.png' });
  await clientPointOf(page, 24, 50);
  await page.screenshot({ path: 'test-results/hubs.png' });

  // Paused: boats and planes hold still.
  await page.getByTestId('speed-0').click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__cityDebug?.hubSample() ?? []);
  expect(before.length).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cityDebug?.hubSample() ?? [])).toEqual(before);
});
