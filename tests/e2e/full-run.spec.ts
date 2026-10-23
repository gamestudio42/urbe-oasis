import { expect, test, type Page } from '@playwright/test';
import { clickTile, clientPointOf, dragTiles, startCity, tile, waitForCity } from './helpers';

const stats = (page: Page) => page.evaluate(() => window.__cityDebug?.getStats() ?? null);
const hash = (page: Page) => page.evaluate(() => window.__cityDebug?.hash());

test('starts, builds with the tools, grows, saves and reloads the same city', async ({ page }) => {
  test.setTimeout(120_000);
  await startCity(page, 'full-run', { name: 'Vila E2E', size: 64, hills: 0, difficulty: 'easy' });
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(16, 10));
  expect(area).toBeTruthy();
  const { x, y } = area as { x: number; y: number };
  await clientPointOf(page, x + 8, y + 5);

  // A street with homes on one side, shops and industry on the other, and a power plant.
  await page.getByTestId('tool-road').click();
  await dragTiles(page, [x, y + 5], [x + 15, y + 5]);
  await page.getByTestId('tool-zoneResLight').click();
  await dragTiles(page, [x, y + 2], [x + 11, y + 4]);
  await page.getByTestId('tool-zoneComLight').click();
  await dragTiles(page, [x, y + 6], [x + 5, y + 8]);
  await page.getByTestId('tool-zoneIndLight').click();
  await dragTiles(page, [x + 6, y + 6], [x + 11, y + 8]);
  await page.getByTestId('tool-coalPlant').click();
  await clickTile(page, x + 13, y + 3);
  expect((await tile(page, x + 15, y + 5))?.road).toBe(true);
  expect((await tile(page, x + 3, y + 3))?.zone).toBe(1);
  expect((await tile(page, x + 8, y + 7))?.zone).toBe(3);
  expect((await tile(page, x + 13, y + 3))?.buildingId).toBeTruthy();

  // Eighteen months of growth.
  await page.evaluate(() => window.__cityDebug?.runTicks(120 * 18));
  await expect.poll(async () => (await stats(page))?.population ?? 0).toBeGreaterThan(50);
  const grown = await stats(page);
  expect(grown?.counts.residential).toBeGreaterThan(5);
  expect(grown?.power.served).toBeGreaterThan(0.9);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/full-run.png' });
  const before = await hash(page);

  await page.getByTestId('open-system').click();
  await page.getByTestId('save-now').click();
  await expect(page.getByTestId('toasts')).toContainText('Cidade salva.');

  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  const slot = page.locator('[data-slot="city:full-run:Vila E2E"]');
  await expect(slot).toBeVisible();
  await slot.getByTestId('load-slot').click();
  await waitForCity(page);
  await expect(page.locator('.paused-banner')).toBeVisible();
  expect(await hash(page)).toBe(before);
  const loaded = await stats(page);
  expect(loaded?.population).toBe(grown?.population);
  expect(loaded?.funds).toBe(grown?.funds);
  expect((await tile(page, x + 8, y + 5))?.road).toBe(true);

  // The loaded city keeps running.
  await page.getByTestId('speed-3').click();
  await expect.poll(async () => (await stats(page))?.tick ?? 0).toBeGreaterThan(loaded?.tick ?? 0);
});

test('mutes the sound effects and remembers the choice', async ({ page }) => {
  await startCity(page, 'sound');
  await page.getByTestId('open-system').click();
  const toggle = page.getByTestId('sound-enabled');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  expect(await page.evaluate(() => localStorage.getItem('cityBuilder.muted'))).toBe('1');

  await startCity(page, 'sound');
  await page.getByTestId('open-system').click();
  await expect(page.getByTestId('sound-enabled')).not.toBeChecked();
  await page.getByTestId('system-panel').locator('h3').first().click();
  await page.keyboard.press('m');
  await expect(page.getByTestId('sound-enabled')).toBeChecked();
});
