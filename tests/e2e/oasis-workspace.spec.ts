import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';

test('construction categories expose names and costs, preserve tools on Escape, and fit smaller screens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const { engine, onMonth } = SIM_PRESETS['oasis-balanced']!.create('1', 64);
  for (let m = 0; m < 12; m++) {
    engine.runMonths(1);
    onMonth(engine);
  }
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      {
        population: engine.stats().population,
        funds: engine.economy.funds,
        savedAt: '2026-10-24T00:00:00.000Z',
      },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 19);
    window.__cityDebug!.setZoom(1.7);
  });
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  await expect(page.getByTestId('tool-category-utilities')).toBeVisible();
  await expect(page.getByTestId('tool-canal')).toBeHidden();
  await page.screenshot({ path: 'test-results/oasis-district-workspace.png' });
  await page.getByTestId('tool-category-utilities').click();
  await expect(page.getByTestId('construction-utilities')).toBeVisible();
  await expect(page.getByTestId('tool-canal')).toContainText('Canal');
  await expect(page.getByTestId('tool-canal')).toContainText('$5');
  await page.screenshot({ path: 'test-results/oasis-construction-library.png' });
  await page.getByTestId('tool-canal').click();
  await expect(page.getByTestId('construction-utilities')).toBeHidden();
  await expect(page.getByTestId('construction-selection')).toContainText('Canal');
  await page.getByTestId('tool-category-services').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('construction-services')).toBeHidden();
  await expect(page.getByTestId('tool-category-services')).toBeFocused();
  await expect(page.getByTestId('tool-canal')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('r');
  await expect(page.getByTestId('construction-selection')).toContainText('Estrada');
  for (const width of [1024, 800, 390]) {
    await page.setViewportSize({ width, height: 760 });
    await page.getByTestId('tool-category-utilities').click();
    for (const id of ['toolbar', 'construction-utilities']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(760);
    }
    await expect(page.getByTestId('tool-canal')).toBeInViewport();
    if (width > 720) {
      const map = await page.getByTestId('minimap').boundingBox();
      const dock = await page.getByTestId('toolbar').boundingBox();
      expect(map!.x + map!.width).toBeLessThan(dock!.x);
    }
    await page.screenshot({ path: `test-results/oasis-workspace-${width}.png` });
    await page.keyboard.press('Escape');
    await page.getByTestId('open-system').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('open-system')).toBeInViewport();
  }
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
});
