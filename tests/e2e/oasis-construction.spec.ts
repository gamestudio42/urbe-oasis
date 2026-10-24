import { encodeSave, OASIS_SAVE_FORMAT, OASIS_SHADE } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

async function point(page: Page, x: number, y: number) {
  const p = await page.evaluate(({ x, y }) => window.__cityDebug!.tileToClient(x, y), { x, y });
  expect(p).not.toBeNull();
  return p!;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const engine = createEngine({
    seed: 'construction-input',
    size: 32,
    ruleset: 'oasis',
    funds: OASIS_SHADE.canalCost * 3,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  engine.disastersEnabled = false;
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
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(12, 12);
    window.__cityDebug!.setZoom(1.5);
  });
  await page.getByTestId('tool-canal').click();
});

test('canal preview agrees with the actual drag and its charged cost', async ({ page }) => {
  const start = await point(page, 10, 10);
  const end = await point(page, 11, 10);
  const funds = await page.evaluate(() => window.__cityDebug!.getStats()!.funds);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  const tooltip = page.getByTestId('tool-tooltip');
  await expect(tooltip).toContainText('2');
  await expect(tooltip).not.toHaveClass(/\bbad\b/);
  await page.screenshot({ path: 'test-results/oasis-construction-preview.png' });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.getStats()!.funds))
    .toBe(funds - 2 * OASIS_SHADE.canalCost);
  for (const x of [10, 11]) {
    const tile = await page.evaluate((x) => window.__cityDebug!.getTile(x, 10), x);
    expect(tile!.canal).toBe(true);
  }
});

test('a stationary drag updates affordability after a worker delta', async ({ page }) => {
  const start = await point(page, 10, 10);
  const end = await point(page, 11, 10);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  const tooltip = page.getByTestId('tool-tooltip');
  await expect(tooltip).not.toHaveClass(/\bbad\b/);
  expect(
    (
      await page.evaluate(() =>
        window.__cityDebug!.command({ type: 'canal', x0: 2, y0: 2, x1: 3, y1: 2 }),
      )
    ).ok,
  ).toBe(true);
  await expect(tooltip).toHaveClass(/\bbad\b/);
  await expect(tooltip.locator('.tool-tooltip-reason')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await page.evaluate(() => window.__cityDebug!.getTile(10, 10)))!.canal).toBe(false);
});

for (const interruption of ['pointercancel', 'lostpointercapture', 'blur'] as const) {
  test(`an interrupted drag (${interruption}) never builds and the next gesture works`, async ({
    page,
  }) => {
    const start = await point(page, 10, 10);
    const end = await point(page, 11, 10);
    const before = await page.evaluate(() => window.__cityDebug!.hash());
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await expect(page.getByTestId('tool-tooltip')).toBeVisible();
    await page.evaluate((kind) => {
      if (kind === 'blur') window.dispatchEvent(new Event('blur'));
      else
        document
          .querySelector('canvas.game-canvas')!
          .dispatchEvent(new PointerEvent(kind, { pointerId: 1, bubbles: true }));
    }, interruption);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
    await expect(page.getByTestId('tool-tooltip')).toBeHidden();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => window.__cityDebug!.getTile(11, 10)!.canal))
      .toBe(true);
  });
}
