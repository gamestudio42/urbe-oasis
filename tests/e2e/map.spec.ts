import { expect, test } from '@playwright/test';
import { clientPointOf, startCity } from './helpers';

test('renders the isometric map and selects the clicked tile', async ({ page }) => {
  await startCity(page);
  const canvas = page.locator('canvas.game-canvas');
  await expect(canvas).toBeVisible();

  for (const [x, y] of [
    [64, 64],
    [60, 70],
    [75, 58],
  ] as const) {
    const point = await clientPointOf(page, x, y);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.up();
    const selected = await page.evaluate(() => window.__cityDebug?.getSelected());
    // Hills may hide the exact tile behind a taller one in front; flat tiles must match exactly.
    const tile = await page.evaluate(
      ([tx, ty]) => window.__cityDebug?.getTile(tx as number, ty as number),
      [x, y],
    );
    if (tile?.flat) expect(selected).toEqual({ x, y });
    else expect((selected?.x ?? 0) + (selected?.y ?? 0)).toBeGreaterThanOrEqual(x + y);
  }
  await page.screenshot({ path: 'test-results/map.png' });
});

test('generates the same terrain for the same seed', async ({ page }) => {
  await startCity(page, 'same-seed');
  const first = await page.evaluate(() => window.__cityDebug?.terrainHash());
  await startCity(page, 'same-seed');
  const second = await page.evaluate(() => window.__cityDebug?.terrainHash());
  expect(first).toBeTruthy();
  expect(first).toBe(second);
});
