import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { createEngine, SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';

for (const populated of [false, true]) {
  test(`survival indicators align wrapped rows in a ${populated ? 'populated' : 'new'} city`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cityBuilder.locale', 'pt-BR');
      localStorage.setItem('oasis.tutorial.founding.v1', '1');
    });
    const engine = populated
      ? SIM_PRESETS['oasis-balanced']!.create('1', 64).engine
      : createEngine({ seed: 'status-layout', size: 32, name: 'Oásis', ruleset: 'oasis' });
    if (populated) engine.runMonths(12);
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
    const hash = await page.evaluate(() => window.__cityDebug!.hash());
    for (const width of [1440, 800, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const panel = page.getByTestId('oasis-status');
      await expect(panel).toBeInViewport();
      for (const tag of ['span', 'strong', 'small']) {
        const rows = await panel.locator(`.oasis-resource > ${tag}`).evaluateAll((elements) =>
          elements.map((element) => ({
            top: element.getBoundingClientRect().top,
            left: element.getBoundingClientRect().left,
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
            overflow: element.scrollWidth - element.clientWidth,
          })),
        );
        expect(rows).toHaveLength(3);
        // Every width keeps the three shares side by side; phones drop the supply line.
        const positions = rows.map((r) => r.top);
        expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(1);
        expect(rows.every((r) => r.overflow <= 1)).toBe(true);
        const widths = rows.map((r) => r.width);
        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
        if (!populated && width >= 800 && tag === 'strong') {
          expect(rows.every((r) => r.height <= r.lineHeight + 1)).toBe(true);
        }
      }
      if (width <= 600) await expect(panel.locator('.oasis-resource > small').first()).toBeHidden();
      if (!process.env.CI) {
        await panel.screenshot({
          path: `test-results/oasis-status-${populated ? 'populated' : 'empty'}-${width}.png`,
        });
      }
      await page.getByTestId('oasis-water').click();
      await expect(page.getByTestId('oasis-water')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('oasis-water').click();
    }
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(hash);
  });
}
