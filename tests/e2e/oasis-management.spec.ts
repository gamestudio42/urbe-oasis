import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { createEngine, SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';
import { formatMoney } from '../../apps/web/src/i18n';

for (const width of [1440, 390]) {
  test(`management panels expose real reports, keyboard controls and confirmed scenarios at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('cityBuilder.locale', 'pt-BR');
      localStorage.setItem('oasis.tutorial.founding.v1', '1');
    });
    const { engine } = SIM_PRESETS['oasis-balanced']!.create('1', 64);
    engine.runMonths(12);
    const report = engine.stats().lastMonth;
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
    expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(
      true,
    );
    await page.waitForFunction(() => window.__cityDebug?.isReady());
    await page.getByTestId('open-budget').scrollIntoViewIfNeeded();
    await page.getByTestId('open-budget').click();
    await expect(page.getByTestId('budget-period')).toContainText('Dez 2000');
    await expect(page.getByTestId('budget-net')).toHaveText(formatMoney(report.net, 'pt-BR'));
    await expect(page.getByTestId('budget-revenue')).toHaveText(
      formatMoney(
        Object.values(report.revenue).reduce((a, b) => a + b, 0),
        'pt-BR',
      ),
    );
    await expect(page.getByTestId('budget-expenses')).toHaveText(
      formatMoney(
        Object.values(report.expenses).reduce((a, b) => a + b, 0),
        'pt-BR',
      ),
    );
    const budget = page.getByTestId('budget-panel');
    expect(await budget.evaluate((p) => p.scrollWidth <= p.clientWidth + 1)).toBe(true);
    const rows = await budget
      .locator('.ledger:first-child tr')
      .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().height));
    expect(Math.max(...rows)).toBeLessThan(40);
    await page.screenshot({ path: `test-results/oasis-budget-redesign-${width}.png` });
    await page.getByTestId('tax-residential').fill('12');
    await expect
      .poll(() => page.evaluate(() => window.__cityDebug!.getStats()!.taxes.residential))
      .toBe(12);
    await page.getByTestId('funding-police').fill('65');
    await expect
      .poll(() => page.evaluate(() => window.__cityDebug!.getStats()!.funding.police))
      .toBe(65);
    await page.getByTestId('funding-police').press('Escape');
    await expect(budget).toBeHidden();
    await expect(page.getByTestId('open-budget')).toBeFocused();

    await page.getByTestId('open-system').scrollIntoViewIfNeeded();
    await page.getByTestId('open-system').click();
    await expect(page.getByTestId('trigger-crisis')).toBeHidden();
    await page.getByTestId('sound-enabled').uncheck();
    await expect(page.getByTestId('music-enabled')).toBeDisabled();
    await page.getByTestId('sound-enabled').check();
    await expect(page.getByTestId('music-enabled')).toBeEnabled();
    await page.getByRole('button', { name: 'Idioma', exact: true }).click();
    await expect(page.getByRole('listbox', { name: 'Idioma', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox', { name: 'Idioma', exact: true })).toBeHidden();
    await expect(page.getByTestId('system-panel')).toBeVisible();
    const menu = page.getByTestId('system-panel');
    expect(await menu.evaluate((p) => p.scrollWidth <= p.clientWidth + 1)).toBe(true);
    await menu.locator('.panel-body').evaluate((body) => (body.scrollTop = 0));
    await page.screenshot({ path: `test-results/oasis-menu-redesign-${width}.png` });
    const before = await page.evaluate(() => window.__cityDebug!.hash());
    await page.getByTestId('system-scenarios').locator('summary').click();
    await page.getByTestId('trigger-crisis').click();
    await expect(page.getByTestId('cancel-disaster')).toBeFocused();
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('scenario-confirmation')).toBeHidden();
    await expect(page.getByTestId('trigger-crisis')).toBeFocused();
    await expect(menu).toBeVisible();
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
    await page.getByTestId('trigger-crisis').click();
    await page.getByTestId('confirm-disaster').click();
    await expect(page.getByTestId('scenario-confirmation')).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__cityDebug!.getStats()!.disasters.some((d) => d.kind === 'crisis'),
        ),
      )
      .toBe(true);
    await page.getByTestId('return-to-city').click();
    await expect(menu).toBeHidden();
    await expect(page.getByTestId('open-system')).toBeFocused();
    await page.getByTestId('open-budget').click();
    await page.getByTestId('open-system').click();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByTestId('open-system')).toBeFocused();
  });
}

test('a new city does not present an empty report as a completed month', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const engine = createEngine({ seed: 'no-report', size: 32, name: 'Oásis', ruleset: 'oasis' });
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: 0, funds: engine.economy.funds, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.getByTestId('open-budget').click();
  await expect(page.getByTestId('budget-period')).toContainText('primeiro relatório');
  await expect(page.getByTestId('budget-net')).toHaveText('—');
});
