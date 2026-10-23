import { expect, test } from '@playwright/test';
import { clickTile, clientPointOf, dragTiles, startCity, tile } from './helpers';

test('builds roads, zones and a power plant, then demolishes it', async ({ page }) => {
  await startCity(page);
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(12, 9));
  expect(area).toBeTruthy();
  const { x, y } = area as { x: number; y: number };
  await clientPointOf(page, x + 6, y + 4);
  const fundsBefore = (await page.evaluate(() => window.__cityDebug?.getStats()?.funds)) as number;
  let treeTiles = 0;
  for (let k = 0; k < 12; k++) if (((await tile(page, x + k, y + 3))?.trees ?? 0) > 0) treeTiles++;

  await page.getByTestId('tool-road').click();
  await dragTiles(page, [x, y + 3], [x + 11, y + 3]);
  expect((await tile(page, x + 5, y + 3))?.road).toBe(true);
  expect((await tile(page, x + 11, y + 3))?.road).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => window.__cityDebug?.getStats()?.funds))
    .toBe(fundsBefore - 12 * 10 - treeTiles * 2);

  await page.getByTestId('tool-zoneResLight').click();
  await dragTiles(page, [x, y], [x + 11, y + 2]);
  expect((await tile(page, x + 4, y + 1))?.zone).toBe(1);

  await page.getByTestId('tool-coalPlant').click();
  await clickTile(page, x + 3, y + 6);
  const plantTile = await tile(page, x + 2, y + 5);
  expect(plantTile?.buildingId).toBeTruthy();

  // Building a road over the plant is refused with a message.
  await page.getByTestId('tool-road').click();
  await dragTiles(page, [x + 3, y + 5], [x + 3, y + 6]);
  await expect(page.getByTestId('toasts')).toContainText('Área ocupada');
  await page.screenshot({ path: 'test-results/build.png' });

  await page.getByTestId('tool-demolish').click();
  await clickTile(page, x + 3, y + 6);
  expect((await tile(page, x + 2, y + 5))?.buildingId).toBeNull();
});

test('shows a live preview with the cost while dragging', async ({ page }) => {
  await startCity(page);
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(8, 4));
  const { x, y } = area as { x: number; y: number };
  await clientPointOf(page, x + 4, y + 2);
  await page.getByTestId('tool-road').click();
  const a = await clientPointOf(page, x, y, false);
  const b = await clientPointOf(page, x + 7, y, false);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await expect(page.getByTestId('tool-tooltip')).toContainText(/Custo: \$\d+ · 8 lotes/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await tile(page, x + 3, y))?.road).toBe(false);
});
