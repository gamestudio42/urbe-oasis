import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS, type SimulationEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

/** The journey preset advanced until `until` holds after a month. */
function save(until: (engine: SimulationEngine) => boolean): string {
  const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
  for (let m = 0; m < 60 && !until(run.engine); m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  expect(until(run.engine)).toBe(true);
  return JSON.stringify(
    encodeSave(
      run.engine.serialize(),
      { population: 0, funds: 0, savedAt: '2026-10-26T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
}

async function open(page: Page, text: string) {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((t) => window.__cityDebug!.importText(t), text)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

test('after the journey, the guide shows the title, the next rank and the coming dry season', async ({
  page,
}) => {
  await open(
    page,
    save((e) => (e.oasis.journey?.era?.rank ?? 0) === 1),
  );
  const guide = page.getByTestId('oasis-next-steps');
  await expect(guide).toContainText('Era do oásis');
  await expect(guide).toContainText('Vila');
  await page.getByTestId('oasis-guide-toggle').click();
  await expect(page.getByTestId('oasis-era')).toHaveAttribute('data-rank', '1');
  await expect(page.getByTestId('oasis-era-next')).toContainText('Próximo título: Cidade');
  await expect(page.getByTestId('oasis-era-row-reserves')).toBeVisible();
  await expect(page.getByTestId('oasis-era-drought')).toContainText('Próxima estação seca em');
  await expect(page.getByTestId('oasis-era-drought-detail')).toContainText('qanats a');
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-era.png' });
});

test('during an era dry season, the card counts down and offers rationing', async ({ page }) => {
  await open(
    page,
    save((e) => (e.oasis.journey?.era?.droughtMonthsLeft ?? 0) > 0),
  );
  await page.getByTestId('oasis-guide-toggle').click();
  const drought = page.getByTestId('oasis-era-drought');
  await expect(drought).toHaveAttribute('data-state', 'active');
  await expect(drought).toContainText('Estação seca: faltam');
  expect(
    await page.evaluate(() => window.__cityDebug!.getStats()!.oasis!.journey!.era!.droughtFactor),
  ).toBeLessThan(1);
  await page.getByTestId('oasis-era-ration').click();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.getStats()!.oasis!.waterPolicy.enabled))
    .toBe(true);
  await expect(page.getByTestId('oasis-era-record')).toContainText('Secas superadas');
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.musicState().mood))
    .toBe('scarce');
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-era-drought.png' });
});
