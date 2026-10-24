import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

/** A grown journey city with a staffed caravanserai. */
function grownCity(): string {
  const run = SIM_PRESETS['oasis-journey']!.create('3', 64);
  for (let m = 0; m < 30; m++) {
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

async function open(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect(
    (await page.evaluate((text) => window.__cityDebug!.importText(text), grownCity())).ok,
  ).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

const stats = (page: Page) => page.evaluate(() => window.__cityDebug!.animationStats());
const camels = (page: Page) =>
  page.evaluate(() => window.__cityDebug!.hubSample().filter((h) => h.kind === 'camel'));

test('people walk the streets and caravans reach the caravanserai', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 18);
    window.__cityDebug!.setZoom(2);
    window.__cityDebug!.setSpeed(1);
  });
  await expect
    .poll(async () => (await stats(page)).walkers, { timeout: 20_000 })
    .toBeGreaterThan(5);
  await expect
    .poll(async () => (await camels(page)).length, { timeout: 30_000 })
    .toBeGreaterThan(2);
  const first = (await camels(page))[0]!;
  await expect
    .poll(async () => {
      const now = (await camels(page)).find((c) => c.id === first.id);
      return !!now && (now.x !== first.x || now.y !== first.y);
    })
    .toBe(true);

  // Paused: the street freezes but stays populated.
  await page.evaluate(() => window.__cityDebug!.setSpeed(0));
  await page.waitForTimeout(300);
  const frozen = await camels(page);
  await page.waitForTimeout(800);
  expect(await camels(page)).toEqual(frozen);
  expect((await stats(page)).walkers).toBeGreaterThan(0);

  // Far away, people are too small to draw; nothing walks there.
  await page.evaluate(() => window.__cityDebug!.setZoom(0.5));
  await expect.poll(async () => (await stats(page)).walkers).toBe(0);
  if (!process.env.CI) {
    await page.evaluate(() => {
      window.__cityDebug!.setZoom(2.4);
      window.__cityDebug!.setSpeed(1);
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/oasis-city-life.png' });
  }
});

test('turning animations off clears pedestrians and caravans', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 18);
    window.__cityDebug!.setZoom(2);
    window.__cityDebug!.setSpeed(1);
  });
  await expect
    .poll(async () => (await stats(page)).walkers, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await page.getByTestId('open-system').click();
  await page.getByTestId('animations-enabled').uncheck();
  await expect.poll(async () => (await stats(page)).walkers).toBe(0);
  expect((await stats(page)).camels).toBe(0);
  expect(await camels(page)).toEqual([]);
});
