import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, locale: string) {
  await page.addInitScript((language) => {
    localStorage.setItem('cityBuilder.locale', language);
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  }, locale);
  const engine = createEngine({
    seed: 'hud-fit',
    ruleset: 'oasis',
    size: 32,
    name: 'Oásis das Palmeiras Altas',
    funds: 1_250_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: 0, funds: 1_250_000, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

for (const locale of ['pt-BR', 'de'])
  test(`the top bar fits without scrolling from desktop to tablet widths in ${locale}`, async ({
    page,
  }) => {
    await start(page, locale);
    const hud = page.getByTestId('hud');
    for (const width of [1440, 1366, 1280, 1180, 1024, 800, 768, 720]) {
      await page.setViewportSize({ width, height: 720 });
      await expect
        .poll(() => hud.evaluate((node) => node.scrollWidth - node.clientWidth))
        .toBeLessThanOrEqual(0);
      for (const id of ['budget', 'charts', 'overlays', 'system']) {
        const button = page.getByTestId(`open-${id}`);
        await expect(button).toBeInViewport({ ratio: 1 });
        expect(await button.evaluate((node) => node.textContent?.trim().length)).toBeGreaterThan(0);
      }
      if (!process.env.CI && (width === 800 || width === 1280))
        await page.screenshot({
          path: `test-results/oasis-hud-${locale}-${width}.png`,
          clip: { x: 0, y: 0, width, height: 60 },
        });
    }
    // Icon-only buttons keep their accessible names and still open their panels.
    await page.setViewportSize({ width: 800, height: 720 });
    await page.getByTestId('open-overlays').click();
    await expect(page.getByTestId('overlay-panel')).toBeVisible();
    await page.getByTestId('open-system').click();
    await expect(page.getByTestId('system-panel')).toBeVisible();
  });
