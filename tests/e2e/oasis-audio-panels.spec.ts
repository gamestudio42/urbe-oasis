import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';
import { addWater } from '../helpers/engine';

async function expectClearPanel(page: Page, id: string, width: number) {
  const panel = page.getByTestId(id);
  const close = page.getByTestId(`${id}-close`);
  await expect(close).toBeInViewport();
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(10);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  for (const control of ['hud-sound', 'hud-music']) {
    const audio = (await page.getByTestId(control).boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(audio.x - 8);
  }
  // Geometry alone would miss another higher layer intercepting the close button.
  expect(
    await close.evaluate((button) => {
      const r = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
}

for (const [width, height] of [
  [1440, 900],
  [800, 600],
  [390, 760],
  [320, 640],
]) {
  test(`audio and panel close controls remain independently clickable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      localStorage.setItem('cityBuilder.locale', 'pt-BR');
      localStorage.setItem('oasis.tutorial.founding.v1', '1');
    });
    const engine = createEngine({
      seed: 'audio-panels',
      size: 32,
      name: 'Oásis',
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    addWater(engine, 18, 18, 20, 20);
    const save = JSON.stringify(
      encodeSave(
        engine.serialize(),
        {
          population: 0,
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
    for (const [x, y, label] of [
      [14, 14, 'Grama'],
      [19, 19, 'Água'],
    ] as const) {
      const point = await page.evaluate(
        ({ x, y }) => {
          // Keep the inspected lot below the resource card on narrow screens.
          window.__cityDebug!.centerOnTile(x - 4, y - 4);
          return window.__cityDebug!.tileToClient(x, y);
        },
        { x, y },
      );
      await page.mouse.click(point!.x, point!.y);
      await expect(
        page.getByTestId('inspector').getByRole('heading', { name: label, exact: true }),
      ).toBeVisible();
      await expectClearPanel(page, 'inspector', width);
      if (label === 'Grama')
        await page.screenshot({ path: `test-results/oasis-audio-inspector-${width}.png` });
      await page.getByTestId('inspector-close').click();
      await expect(page.getByTestId('inspector')).toBeHidden();
      await expect(page.getByTestId('hud-sound')).toHaveAttribute('aria-pressed', 'true');
    }
    for (const id of ['budget', 'charts', 'overlays', 'system']) {
      const panelId = id === 'overlays' ? 'overlay-panel' : `${id}-panel`;
      await page.getByTestId(`open-${id}`).scrollIntoViewIfNeeded();
      await page.getByTestId(`open-${id}`).click();
      await expectClearPanel(page, panelId, width);
      if (id === 'system') {
        await page.getByTestId('hud-sound').click();
        await expect(page.getByTestId('hud-sound')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByTestId('hud-music')).toBeDisabled();
        await expect(page.getByTestId('system-panel')).toBeVisible();
        await page.getByTestId('hud-sound').click();
        await page.getByTestId('hud-music').click();
        await expect(page.getByTestId('hud-music')).toHaveAttribute('aria-pressed', 'false');
        await page.getByTestId('hud-music').click();
        await page.screenshot({ path: `test-results/oasis-audio-system-${width}.png` });
      }
      await page.getByTestId(`${panelId}-close`).click();
      await expect(page.getByTestId(panelId)).toBeHidden();
    }
    // Inspection and a HUD panel can remain open together, including on short screens.
    const point = await page.evaluate(() => {
      window.__cityDebug!.centerOnTile(10, 10);
      return window.__cityDebug!.tileToClient(14, 14);
    });
    await page.mouse.click(point!.x, point!.y);
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.getByTestId('open-system').click();
    await expectClearPanel(page, 'inspector', width);
    await expectClearPanel(page, 'system-panel', width);
    await page.getByTestId('inspector-close').click();
    await expect(page.getByTestId('inspector')).toBeHidden();
    await expectClearPanel(page, 'system-panel', width);
    await page.getByTestId('system-panel-close').click();
    await expect(page.getByTestId('system-panel')).toBeHidden();
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(hash);
  });
}
