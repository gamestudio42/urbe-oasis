import { encodeSave, OASIS_SAVE_FORMAT, TICKS_PER_MONTH } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';

function city() {
  const { engine, onMonth } = SIM_PRESETS['oasis-balanced']!.create('1', 64);
  for (let m = 0; m < 24; m++) {
    engine.runMonths(1);
    onMonth(engine);
  }
  engine.execute({ type: 'rename', name: 'Dunas' });
  engine.runTicks(4);
  return JSON.stringify(
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
}

test('water management changes real demand, retains accrued cost through a save and restores normal supply', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), city())).ok).toBe(
    true,
  );
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 19);
    window.__cityDebug!.setZoom(1.8);
  });
  const before = await page.evaluate(() => window.__cityDebug!.getStats()!);
  const initialHash = await page.evaluate(() => window.__cityDebug!.hash());
  await page.getByTestId('oasis-policy-open').click();
  await expect(page.getByTestId('oasis-policy-dialog')).toBeVisible();
  await expect(page.getByTestId('oasis-policy-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('oasis-policy-dialog')).toContainText(
    'arrecadação comercial e industrial',
  );
  // Opening and closing the modal must not change the city or select another tool.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('oasis-policy-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(initialHash);
  await page.getByTestId('oasis-policy-open').click();
  await page.getByTestId('oasis-policy-toggle').click();
  await expect(page.getByTestId('oasis-policy-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate((ticks) => window.__cityDebug!.runTicks(ticks), TICKS_PER_MONTH / 2);
  const after = await page.evaluate(() => window.__cityDebug!.getStats()!);
  expect(after.water.demand).toBe(before.oasis!.waterPolicy.rationedDemand);
  expect(after.water.demand).toBeLessThan(before.water.demand);
  expect(after.oasis!.waterPolicy.accruedPenalty).toBe(0.1);
  await expect(page.getByTestId('policy-accrued')).toHaveText('10%');
  await page.screenshot({ path: 'test-results/oasis-water-policy.png' });
  await page.getByTestId('oasis-policy-close').click();
  await page.screenshot({ path: 'test-results/oasis-water-districts.png' });
  const saved = await page.evaluate(() => window.__cityDebug!.exportText());
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), saved)).ok).toBe(
    true,
  );
  await expect(page.getByTestId('oasis-policy-open')).toContainText('Racionamento ativo');
  await page.getByTestId('oasis-policy-open').click();
  await expect(page.getByTestId('policy-accrued')).toHaveText('10%');
  await page.getByTestId('oasis-policy-toggle').click();
  await expect(page.getByTestId('oasis-policy-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('policy-accrued')).toHaveText('10%');
  await page.getByTestId('oasis-policy-close').click();
  await page.evaluate(() => window.__cityDebug!.runTicks(4));
  const restored = await page.evaluate(() => window.__cityDebug!.getStats()!);
  expect(restored.water.demand).toBe(before.water.demand);
  await page.setViewportSize({ width: 800, height: 700 });
  await page.getByTestId('oasis-policy-open').click();
  const dialog = await page.getByTestId('oasis-policy-dialog').boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(800);
  await expect(page.getByTestId('oasis-policy-toggle')).toBeInViewport();
});
