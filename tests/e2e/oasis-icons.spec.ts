import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';
import { TOOLS, TOOL_GROUPS } from '../../apps/web/src/tools/tools';

test('Oasis uses its own complete icon family with themed colors, selected and locked states', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const { engine, onMonth } = SIM_PRESETS['oasis-balanced']!.create('1', 64);
  engine.name = 'Oásis';
  for (let m = 0; m < 12; m++) {
    engine.runMonths(1);
    onMonth(engine);
  }
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
  await expect(page.getByTestId('menu-sound').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'sound',
  );
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 19);
    window.__cityDebug!.setZoom(1.5);
  });
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  await expect(page.getByTestId('tool-select').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'select',
  );
  for (const group of TOOL_GROUPS.filter((g) => g !== 'inspect')) {
    await page.getByTestId(`tool-category-${group}`).click();
    for (const tool of TOOLS.filter((t) => t.group === group)) {
      const icon = page.getByTestId(`tool-${tool.id}`).locator('.construction-glyph > svg').first();
      await expect(icon).toBeAttached();
      await expect(icon).toHaveAttribute('data-icon-id', tool.id);
      await expect(icon).toHaveAttribute('data-icon-style', 'adobe');
      await expect(icon).toHaveAttribute('viewBox', '0 0 32 32');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect((await icon.boundingBox())!.width).toBe(32);
    }
  }
  await page.getByTestId('tool-category-transport').click();
  const marina = page.getByTestId('tool-marina');
  await expect(marina).toHaveAttribute('data-locked', 'true');
  await expect(marina).toContainText('1.000');
  await expect(marina.locator('[data-icon-id="marina"]')).toBeVisible();
  await expect(marina.locator('[data-icon-id="lock"]')).toBeVisible();
  await page.getByTestId('tool-category-utilities').click();
  await expect(page.getByTestId('tool-category-utilities').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'categoryUtilities',
  );
  await page.getByTestId('tool-palm').scrollIntoViewIfNeeded();
  await page.getByTestId('tool-palm').click();
  await expect(page.getByTestId('construction-selection').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'palm',
  );
  await page.getByTestId('tool-category-utilities').click();
  await expect(page.getByTestId('tool-palm').locator('[data-icon-id="check"]')).toBeVisible();
  const accent = page.getByTestId('tool-palm').locator('.oasis-icon-accent').first();
  // Theme injection must supply the real palette, rather than falling back to white.
  await expect(accent).toHaveCSS('stroke', 'rgb(178, 200, 132)');
  await expect(page.getByTestId('tool-canal').locator('.oasis-icon-accent').first()).toHaveCSS(
    'stroke',
    'rgb(128, 199, 189)',
  );
  await page.getByTestId('tool-palm').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/oasis-icons-utilities.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tool-category-utilities')).toBeFocused();
  await page.getByTestId('hud-music').click();
  await expect(page.getByTestId('hud-music').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'musicOff',
  );
  await page.getByTestId('hud-sound').click();
  await expect(page.getByTestId('hud-sound').locator('svg')).toHaveAttribute(
    'data-icon-id',
    'mute',
  );
  await expect(page.getByTestId('hud-music')).toBeDisabled();
  await page.getByTestId('hud-sound').click();
  await page.getByTestId('hud-music').click();
  await page.getByTestId('open-system').click();
  for (const [button, icon] of [
    ['save-now', 'save'],
    ['export-file', 'export'],
    ['import-file-game', 'import'],
  ]) {
    await expect(page.getByTestId(button!).locator('svg')).toHaveAttribute('data-icon-id', icon!);
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 760 });
  await expect
    .poll(async () => {
      const resources = await page.getByTestId('oasis-status').boundingBox();
      const chronicle = await page.getByTestId('oasis-chronicle').boundingBox();
      return chronicle!.y - resources!.y - resources!.height;
    })
    .toBeGreaterThanOrEqual(8);
  await page.getByTestId('tool-category-utilities').click();
  await page.getByTestId('tool-palm').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('tool-palm')).toBeInViewport();
  await expect(page.getByTestId('tool-palm').locator('[data-icon-id="palm"]')).toBeInViewport();
  const bounds = await page.getByTestId('construction-utilities').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  if (!process.env.CI) {
    await page.screenshot({ path: 'test-results/oasis-icons-mobile.png' });
  }
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
});
