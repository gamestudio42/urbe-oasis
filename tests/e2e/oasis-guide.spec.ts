import { encodeSave, OASIS_SAVE_FORMAT, TICKS_PER_MONTH } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

async function found(page: Page, locale = 'pt-BR') {
  await page.addInitScript((language) => {
    localStorage.setItem('cityBuilder.locale', language);
    localStorage.removeItem('oasis.tutorial.founding.v1');
  }, locale);
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('seed-input').fill('oasis-guide');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

for (const locale of ['pt-BR', 'de']) {
  test(`founding guide leaves the construction workspace usable in ${locale}`, async ({ page }) => {
    test.setTimeout(120_000);
    await found(page, locale);
    const before = await page.evaluate(() => window.__cityDebug!.hash());
    const guide = page.getByTestId('tutorial');
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
      [1024, 768],
      [800, 600],
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      const details = page.getByTestId('tutorial-details');
      await expect(details.locator('p')).toBeHidden();
      await page.getByTestId('tutorial-details-toggle').click();
      await expect(details.locator('p')).toBeVisible();
      await expect
        .poll(async () => {
          const box = await guide.boundingBox();
          const dock = await page.getByTestId('oasis-construction').boundingBox();
          return (
            !!box &&
            !!dock &&
            box.x >= 0 &&
            box.y >= (width <= 720 ? 164 : 52) &&
            box.x + box.width <= width &&
            box.y + box.height <= dock.y - 8
          );
        })
        .toBe(true);
      expect(await guide.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      await page.getByTestId('tutorial-details-toggle').click();
      // Real clicks: guide layout must not intercept category buttons or tray tools.
      await page.getByTestId('tool-category-utilities').click();
      await expect(guide).toBeHidden();
      await expect(page.getByTestId('construction-utilities')).toBeVisible();
      await page.getByTestId('tool-qanat').click();
      await expect(guide).toBeVisible();
      await expect(page.getByTestId('tool-qanat')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('oasis-guide-toggle').click();
      await expect(page.getByTestId('tutorial-action')).toBeHidden();
      await expect(page.getByTestId('oasis-status')).toBeVisible();
      await page.getByTestId('oasis-guide-toggle').click();
      if (!process.env.CI && (width === 1280 || width === 390)) {
        await page.screenshot({ path: `test-results/oasis-guide-${locale}-${width}.png` });
      }
    }
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
  });
}

test('optional goals are live, save-derived observations and guide actions preserve the city', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await found(page);
  const emptyHash = await page.evaluate(() => window.__cityDebug!.hash());
  await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('oasis-guide-toggle').click();
  for (const id of ['residents', 'reserves', 'budget', 'protection', 'trade']) {
    await expect(page.getByTestId(`oasis-goal-${id}`)).toHaveAttribute('data-met', 'false');
  }
  await page.getByTestId('oasis-goal-action-budget').click();
  await expect(page.getByTestId('budget-panel')).toBeVisible();
  await expect(page.getByTestId('oasis-next-steps')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByTestId('oasis-guide-review').click();
  await expect(page.getByTestId('tutorial')).toContainText('1/10');
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(emptyHash);

  const { engine } = SIM_PRESETS['oasis-balanced']!.create('1', 64);
  engine.runMonths(24);
  const stats = engine.stats();
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      {
        population: stats.population,
        funds: stats.funds,
        savedAt: '2026-10-24T00:00:00.000Z',
      },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.getByTestId('oasis-guide-toggle').click();
  const expected = {
    residents: stats.population >= 100,
    reserves: stats.oasis!.cisterns.banks > 0 && stats.oasis!.cisterns.charge >= 0.5,
    budget: stats.tick >= TICKS_PER_MONTH && stats.population > 0 && stats.lastMonth.net >= 0,
    protection: stats.oasis!.windbreak > 0,
    trade: stats.oasis!.trade > 0,
  };
  expect(expected.residents).toBe(true);
  for (const [id, met] of Object.entries(expected)) {
    await expect(page.getByTestId(`oasis-goal-${id}`)).toHaveAttribute('data-met', String(met));
  }
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const goals = page.getByTestId('oasis-next-steps');
    await expect
      .poll(async () => {
        const dock = await page.getByTestId('oasis-construction').boundingBox();
        const box = await goals.boundingBox();
        return !!box && !!dock && box.y + box.height <= dock.y - 8;
      })
      .toBe(true);
    expect(await goals.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    if (!process.env.CI) {
      await page.screenshot({ path: `test-results/oasis-goals-${width}.png` });
    }
  }
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  await page.getByTestId('oasis-goal-action-reserves').click();
  await expect(page.getByTestId('tool-cistern')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('oasis-guide-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('oasis-guide-toggle').click();
  await page.getByTestId('oasis-guide-toggle').press('Escape');
  await expect(page.getByTestId('oasis-guide-toggle')).toBeFocused();
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
});
