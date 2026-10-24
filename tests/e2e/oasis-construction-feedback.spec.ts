import { encodeSave, OASIS_SAVE_FORMAT, OASIS_SHADE, PLACEABLE_SPECS } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, funds = 50_000, locale = 'pt-BR') {
  await page.addInitScript((language) => {
    localStorage.setItem('cityBuilder.locale', language);
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  }, locale);
  const engine = createEngine({
    seed: 'build-feedback',
    ruleset: 'oasis',
    size: 32,
    funds,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  engine.disastersEnabled = false;
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: 0, funds, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(12, 12);
    window.__cityDebug!.setZoom(1.5);
  });
}

async function point(page: Page, x: number, y: number) {
  return (await page.evaluate(({ x, y }) => window.__cityDebug!.tileToClient(x, y), { x, y }))!;
}

test('a building silhouette matches placement, survives reduced motion and clears on cancel', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.getByTestId('tool-category-services').click();
  await page.getByTestId('tool-fireStation').click();
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  const offset = Math.floor((PLACEABLE_SPECS.fireStation.size - 1) / 2);
  for (const zoom of [0.75, 1.25, 1.8]) {
    await page.evaluate((zoom) => window.__cityDebug!.setZoom(zoom), zoom);
    const p = await point(page, 12, 12);
    await page.mouse.move(p.x, p.y);
    await expect
      .poll(() => page.evaluate(() => window.__cityDebug!.placementPreview()))
      .toEqual({ kind: 'fireStation', x: 12 - offset, y: 12 - offset, ok: true, visible: true });
    await expect(page.getByTestId('tool-tooltip')).toContainText('Pronto para aplicar');
  }
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-placement-ghost.png' });
  const p = await point(page, 12, 12);
  const funds = await page.evaluate(() => window.__cityDebug!.getStats()!.funds);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'true');
  const actual = await page.evaluate(() => ({
    funds: window.__cityDebug!.getStats()!.funds,
    tile: window.__cityDebug!.getTile(12, 12),
  }));
  expect(actual.tile!.buildingId).toBeGreaterThan(0);
  expect(funds - actual.funds).toBe(PLACEABLE_SPECS.fireStation.cost);
  await expect.poll(() => page.evaluate(() => window.__cityDebug!.placementPreview())).toBeNull();
  await expect(page.getByTestId('tool-tooltip')).toBeHidden();
  const built = await page.evaluate(() => window.__cityDebug!.hash());
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'false');
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.placementPreview()?.ok))
    .toBe(false);
  await expect(page.getByTestId('construction-spent')).toHaveText('$0');
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(built);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__cityDebug!.placementPreview())).toBeNull();
  await expect(page.getByTestId('tool-tooltip')).toBeHidden();
  await page.getByTestId('construction-receipt-close').click();
  await expect(page.getByTestId('construction-receipt')).toBeHidden();
});

test('partial construction and insufficient funds report actual charges without changing rejected lots', async ({
  page,
}) => {
  await start(page, OASIS_SHADE.canalCost * 3);
  await page.evaluate(() =>
    window.__cityDebug!.command({ type: 'canal', x0: 10, y0: 10, x1: 10, y1: 10 }),
  );
  await page.getByTestId('tool-category-utilities').click();
  await page.getByTestId('tool-canal').click();
  const a = await point(page, 10, 10),
    b = await point(page, 12, 10);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await expect(page.getByTestId('construction-affected')).toHaveText('2');
  await expect(page.getByTestId('construction-existing')).toHaveText('1');
  await expect(page.getByTestId('tool-tooltip')).toContainText('Somente lotes válidos');
  await page.mouse.up();
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('construction-applied')).toHaveText('2');
  await expect(page.getByTestId('construction-skipped')).toHaveText('1');
  await expect(page.getByTestId('construction-spent')).toHaveText(`$${OASIS_SHADE.canalCost * 2}`);
  expect(await page.evaluate(() => window.__cityDebug!.getStats()!.funds)).toBe(0);
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  const c = await point(page, 13, 10);
  await page.mouse.move(c.x, c.y);
  await expect(page.getByTestId('tool-tooltip')).toHaveAttribute('data-state', 'blocked');
  await page.mouse.click(c.x, c.y);
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'false');
  await expect(page.getByTestId('construction-spent')).toHaveText('$0');
  await expect(page.getByTestId('construction-applied')).toHaveText('0');
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
});

for (const locale of ['pt-BR', 'de'])
  test(`preview stays inside the viewport near the right edge in ${locale}`, async ({ page }) => {
    await start(page, 50_000, locale);
    await page.getByTestId('tool-category-services').click();
    await page.getByTestId('tool-fireStation').click();
    const before = await page.evaluate(() => window.__cityDebug!.hash());
    for (const [width, height] of [
      [1280, 720],
      [800, 600],
      [390, 844],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await page.mouse.move(width - 4, Math.round(height / 2));
      const preview = page.getByTestId('tool-tooltip');
      await expect(preview).toBeVisible();
      await expect
        .poll(async () => {
          const box = await preview.boundingBox();
          const dock = await page.getByTestId('oasis-construction').boundingBox();
          return (
            !!box &&
            !!dock &&
            box.x >= 8 &&
            box.x + box.width <= width - 8 &&
            box.y >= (width <= 720 ? 164 : 64) &&
            box.y + box.height <= dock.y - 8
          );
        })
        .toBe(true);
      expect(await preview.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      if (!process.env.CI)
        await page.screenshot({ path: `test-results/oasis-preview-edge-${locale}-${width}.png` });
    }
    expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
  });

test('phone construction switches from a readable preview to a receipt and restores the workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByTestId('tool-category-services').click();
  await page.getByTestId('tool-fireStation').click();
  const p = await point(page, 12, 12);
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('tool-tooltip')).toBeVisible();
  await expect(page.getByTestId('oasis-status')).toBeHidden();
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('tool-tooltip')).toBeHidden();
  await expect(page.getByTestId('construction-receipt-close')).toBeInViewport();
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-receipt-phone.png' });
  const next = await point(page, 16, 12);
  await page.mouse.move(next.x, next.y);
  await expect(page.getByTestId('construction-receipt')).toBeHidden();
  await expect(page.getByTestId('tool-tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tool-tooltip')).toBeHidden();
  await expect(page.getByTestId('oasis-status')).toBeVisible();
});
