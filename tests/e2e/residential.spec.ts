import { encodeSave, ZONE_SPECS } from '@city/shared';
import { flatCity } from '@city/simulation';
import { expect, test } from '@playwright/test';
import { clientPointOf, startCity, waitForCity } from './helpers';

/** Residential north of the road, commercial south — four styles each, levels 3–5. */
function residentialTowerSave(): string {
  const e = flatCity('res-towers', 64, 200_000);
  e.execute({ type: 'road', x0: 18, y0: 29, x1: 36, y1: 29 });
  const plant = (
    kind: 'residential' | 'commercial',
    x: number,
    y: number,
    level: number,
    variant: number,
  ) => {
    const capacity = ZONE_SPECS[kind].capacity[level] as number;
    e.buildings.add({
      kind,
      x,
      y,
      w: 1,
      h: 1,
      level,
      capacity,
      occupancy: capacity,
      condition: 100,
      age: 24,
      abandoned: false,
      emptyMonths: 0,
      variant,
      powered: true,
      watered: true,
      offline: 0,
      attractiveness: 1,
    });
  };
  for (let style = 0; style < 4; style++) {
    for (let row = 0; row < 3; row++) {
      const level = 5 - row;
      plant('residential', 22 + style * 3, 22 + row * 2, level, style);
      plant('commercial', 22 + style * 3, 31 + row * 2, level, style);
    }
  }
  const s = e.stats();
  return JSON.stringify(
    encodeSave(e.serialize(), {
      population: s.population,
      funds: s.funds,
      savedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
}

test('dense residential lots use four wall colors and silhouettes', async ({ page }) => {
  const save = residentialTowerSave();
  await startCity(page, 'res-towers', { size: 64, hills: 0 });
  const loaded = await page.evaluate((text) => window.__cityDebug?.importText(text), save);
  expect(loaded?.ok).toBe(true);
  await waitForCity(page);
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));

  const counts = await page.evaluate(() => window.__cityDebug?.getStats()?.counts);
  expect(counts?.residential).toBe(12);
  expect(counts?.commercial).toBe(12);

  await clientPointOf(page, 26, 29);
  await page.screenshot({ path: 'test-results/residential-towers.png' });
});
