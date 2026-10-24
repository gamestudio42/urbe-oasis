import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';

/** A busy city: traffic, smoke, pedestrians and caravans all on screen. */
function busyCity(): string {
  const run = SIM_PRESETS['oasis-journey']!.create('3', 64);
  for (let m = 0; m < 36; m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  return JSON.stringify(
    encodeSave(
      run.engine.serialize(),
      { population: 0, funds: 0, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
}

test('a long run keeps renderer objects bounded and stops generating textures', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), busyCity())).ok).toBe(
    true,
  );
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(32, 32);
    window.__cityDebug!.setZoom(1.6);
    window.__cityDebug!.setSpeed(3);
  });
  const stats = () => page.evaluate(() => window.__cityDebug!.renderStats());
  await page.waitForTimeout(8000);
  const warm = await stats();
  expect(warm.chunks).toBeGreaterThan(0);
  expect(warm.visibleChunks).toBeLessThanOrEqual(warm.chunks);
  await page.waitForTimeout(20_000);
  const later = await stats();
  // Months of growth add a few new building looks; moving sprites are recycled, not kept.
  expect(later.textures - warm.textures).toBeLessThanOrEqual(12);
  expect(later.displayObjects).toBeLessThan(warm.displayObjects * 1.5 + 200);
  expect(later.chunks).toBe(warm.chunks);
});
