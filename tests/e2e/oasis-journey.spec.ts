import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS, droughtActive, type SimulationEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';
import { openWorldOptions } from './helpers';

/** A save of the journey preset, advanced until `until` holds after a month. */
function journeySave(until: (engine: SimulationEngine) => boolean): string {
  const run = SIM_PRESETS['oasis-journey']!.create('probe', 64);
  const e = run.engine;
  for (let m = 0; m < 48 && !until(e); m++) {
    e.runMonths(1);
    run.onMonth(e);
  }
  expect(until(e)).toBe(true);
  return JSON.stringify(
    encodeSave(
      e.serialize(),
      { population: 0, funds: e.economy.funds, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
}

async function open(page: Page, save: string) {
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
});

test('a city founded from the menu starts the journey after the tutorial', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('oasis.tutorial.founding.v1'));
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  await openWorldOptions(page);
  await page.getByTestId('seed-input').fill('oasis-journey');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  expect(await page.evaluate(() => window.__cityDebug!.getStats()!.oasis!.journey?.chapter)).toBe(
    0,
  );
  await page.getByTestId('tutorial-skip').click();
  const guide = page.getByTestId('oasis-next-steps');
  await expect(guide).toHaveAttribute('data-journey', '0');
  await expect(guide).toContainText('Jornada do oásis · Capítulo 1 de 5');
  await expect(guide).toContainText('Primeiro bairro');
  await page.getByTestId('oasis-guide-toggle').click();
  await expect(page.getByTestId('oasis-journey-row-residents')).toContainText('0 / 100');
  await expect(page.getByTestId('oasis-journey-row-residents')).toHaveAttribute(
    'data-met',
    'false',
  );
  await expect(page.getByTestId('oasis-journey-reward')).toContainText('$2.000');
  await page.getByTestId('oasis-journey-tool-pipe').click();
  await expect(page.getByTestId('construction-selection')).toContainText('Tubulação de água');
  if (!process.env.CI) {
    await page.getByTestId('oasis-guide-toggle').click();
    await page.screenshot({ path: 'test-results/oasis-journey-start.png' });
  }
});

test('legacy Oasis saves keep the optional goals instead of a journey', async ({ page }) => {
  const run = SIM_PRESETS['oasis-balanced']!.create('legacy', 64);
  run.engine.runMonths(2);
  await open(
    page,
    JSON.stringify(
      encodeSave(
        run.engine.serialize(),
        { population: 0, funds: 0, savedAt: '2026-10-24T00:00:00.000Z' },
        { format: OASIS_SAVE_FORMAT },
      ),
    ),
  );
  const guide = page.getByTestId('oasis-next-steps');
  await expect(guide).not.toHaveAttribute('data-journey');
  await page.getByTestId('oasis-guide-toggle').click();
  await expect(page.getByTestId('oasis-goal-residents')).toBeVisible();
});

test('the dry season shows its months, live service and a rationing control', async ({ page }) => {
  await open(
    page,
    journeySave((e) => droughtActive(e)),
  );
  const guide = page.getByTestId('oasis-next-steps');
  await expect(guide).toHaveAttribute('data-journey', '3');
  await expect(guide).toContainText('Estação seca');
  await page.getByTestId('oasis-guide-toggle').click();
  const drought = page.getByTestId('oasis-drought');
  await expect(drought).toHaveAttribute('data-state', 'active');
  await expect(drought).toContainText('Seca: faltam');
  await expect(page.getByTestId('oasis-journey-reward')).toContainText('se a água resistir');
  await page.getByTestId('oasis-drought-ration').click();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.getStats()!.oasis!.waterPolicy.enabled))
    .toBe(true);
  await expect(page.getByTestId('oasis-drought-ration')).toHaveAttribute('aria-pressed', 'true');
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-journey-drought.png' });
});

test('a completed chapter announces its grant and moves the guide on', async ({ page }) => {
  // One month before the shelter chapter completes in the preset run.
  await open(
    page,
    journeySave(
      (e) => e.oasis.journey!.chapter === 2 && e.buildings.ofKind('windbreak').length >= 2,
    ),
  );
  await expect(page.getByTestId('oasis-next-steps')).toHaveAttribute('data-journey', '2');
  const funds = await page.evaluate(() => window.__cityDebug!.getStats()!.funds);
  await page.evaluate(() => window.__cityDebug!.setSpeed(3));
  await expect(page.getByTestId('oasis-next-steps')).toHaveAttribute('data-journey', '3', {
    timeout: 45_000,
  });
  await expect(page.locator('.toast').filter({ hasText: 'Capítulo 3 de 5' })).toBeVisible();
  await expect(page.getByTestId('oasis-next-steps')).toContainText('Estação seca');
  expect(await page.evaluate(() => window.__cityDebug!.getStats()!.funds)).not.toBe(funds);
});
