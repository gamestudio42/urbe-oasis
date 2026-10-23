import { expect, test } from '@playwright/test';
import { clickTile, clientPointOf, startCity } from './helpers';

test('main menu options reach the HUD and the panels', async ({ page }) => {
  await startCity(page, 'ui', { difficulty: 'easy' });
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('funds')).toHaveText('$20.000');
  await expect(page.getByTestId('rci')).toBeVisible();
  await expect(page.getByTestId('minimap')).toBeVisible();

  await page.getByTestId('speed-0').click();
  await expect(page.locator('.paused-banner')).toBeVisible();

  await page.getByTestId('open-budget').click();
  await expect(page.getByTestId('budget-panel')).toBeVisible();
  await page.getByTestId('tax-residential').fill('12');
  await expect
    .poll(async () => page.evaluate(() => window.__cityDebug?.getStats()?.taxes.residential))
    .toBe(12);

  await page.evaluate(() => window.__cityDebug?.runTicks(360));
  await page.getByTestId('open-charts').click();
  await expect(page.getByTestId('budget-panel')).toBeHidden();
  await expect(page.getByTestId('charts-panel')).toBeVisible();
  await expect(page.getByTestId('chart-canvas')).toBeVisible();
  await page.getByTestId('chart-tab-money').click();
  await expect(page.getByTestId('chart-tab-money')).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('open-overlays').click();
  await page.getByTestId('overlay-pollution').click();
  await expect(page.getByTestId('overlay-legend')).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-panels.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-panel')).toBeHidden();

  await page.getByTestId('open-system').click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('back-to-menu').click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-menu.png' });
});

test('the inspector explains why a zone does not grow', async ({ page }) => {
  await startCity(page, 'inspector');
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(12, 4));
  const { x, y } = area as { x: number; y: number };
  await page.evaluate(
    async ([ax, ay]) => {
      const debug = window.__cityDebug;
      await debug?.command({ type: 'road', x0: ax, y0: ay + 3, x1: ax + 11, y1: ay + 3 });
      await debug?.command({
        type: 'zone',
        zone: 1,
        density: 1,
        x0: ax,
        y0: ay,
        x1: ax + 11,
        y1: ay + 2,
      });
      await debug?.runTicks(240);
    },
    [x, y] as const,
  );

  await clientPointOf(page, x + 5, y + 1);
  await clickTile(page, x + 5, y + 1);
  const inspector = page.getByTestId('inspector');
  await expect(inspector).toBeVisible();
  const problems = page.getByTestId('problems');
  await expect(problems.locator('[data-code="NO_POWER"]')).toBeVisible();
  await expect(problems.locator('[data-code="NO_JOB_ACCESS"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-inspector.png' });
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
});

test('the minimap recentres the camera', async ({ page }) => {
  await startCity(page, 'minimap');
  const before = await page.evaluate(() => window.__cityDebug?.tileToClient(64, 64));
  const box = await page.getByTestId('minimap').boundingBox();
  expect(box).toBeTruthy();
  const b = box as { x: number; y: number; width: number; height: number };
  await page.mouse.click(b.x + b.width * 0.25, b.y + b.height * 0.5);
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => window.__cityDebug?.tileToClient(64, 64));
  expect(after?.x).not.toBeCloseTo(before?.x ?? 0, 0);
});

test('the tutorial advances and can be skipped for good', async ({ page }) => {
  await startCity(page, 'tutorial', { tutorial: true });
  const tutorial = page.getByTestId('tutorial');
  await expect(tutorial).toContainText('1/7');
  await page.getByTestId('tutorial-next').click();
  await expect(tutorial).toContainText('2/7');
  await page.screenshot({ path: 'test-results/ui-tutorial.png' });
  await page.getByTestId('tutorial-skip').click();
  await expect(tutorial).toBeHidden();

  await page.reload();
  await page.getByTestId('start-city').click();
  await page.getByTestId('hud').waitFor();
  await expect(tutorial).toBeHidden();
});
