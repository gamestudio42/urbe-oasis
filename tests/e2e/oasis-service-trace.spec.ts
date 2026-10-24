import { encodeSave, OASIS_SAVE_FORMAT, ZoneDensity, ZoneType } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const engine = createEngine({
    seed: 'service-trace',
    ruleset: 'oasis',
    size: 32,
    funds: 50_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  engine.disastersEnabled = false;
  const zone = { zone: ZoneType.Residential, density: ZoneDensity.Light };
  expect(engine.execute({ type: 'zone', ...zone, x0: 12, y0: 12, x1: 12, y1: 12 }).ok).toBe(true);
  expect(engine.execute({ type: 'place', kind: 'palm', x: 15, y: 12 }).ok).toBe(true);
  expect(engine.execute({ type: 'place', kind: 'springHouse', x: 20, y: 20 }).ok).toBe(true);
  const save = JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: 0, funds: 50_000, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(14, 14);
    window.__cityDebug!.setZoom(1.5);
  });
}

async function point(page: Page, x: number, y: number) {
  return (await page.evaluate(({ x, y }) => window.__cityDebug!.tileToClient(x, y), { x, y }))!;
}

async function inspect(page: Page, x: number, y: number) {
  await page.getByTestId('tool-select').click();
  const p = await point(page, x, y);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.__cityDebug!.getSelected())).toEqual({ x, y });
}

test('explains a lot without shade, shows the reach while digging and confirms the result', async ({
  page,
}) => {
  await start(page);
  await inspect(page, 12, 12);
  const shade = page.getByTestId('service-shade');
  await expect(shade).toHaveAttribute('data-status', 'disconnected');
  await expect(page.getByTestId('service-why-shade')).toContainText('palmeiras nativas');
  await expect(page.getByTestId('service-water')).toHaveAttribute('data-status', 'disconnected');
  await expect(page.getByTestId('service-why-water')).toContainText('nascente não abastece');
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-services-why.png' });
  await page.getByTestId('inspector-close').click();

  await page.getByTestId('tool-category-utilities').click();
  await page.getByTestId('tool-canal').click();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.serviceView().overlay))
    .toBe('data');
  const a = await point(page, 13, 12);
  const b = await point(page, 14, 12);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  const network = page.getByTestId('construction-network');
  await expect(network).toHaveAttribute('data-network', 'shade');
  await expect(network).toHaveAttribute('data-sources', '1');
  await expect(network).toHaveAttribute('data-active', '1');
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.serviceView().trace))
    .toMatchObject({ sources: 1, idle: 0 });
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-network-preview.png' });
  await page.mouse.up();
  await expect(page.getByTestId('construction-receipt')).toHaveAttribute('data-ok', 'true');

  await page.getByTestId('tool-select').click();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.serviceView().overlay))
    .toBe('none');
  await inspect(page, 12, 12);
  await expect(shade).toHaveAttribute('data-status', 'served');

  await inspect(page, 20, 20);
  await expect(page.getByTestId('service-shade')).not.toHaveAttribute('data-status', 'served');
  await expect(page.getByTestId('service-why-shade')).toContainText('sem energia');
  await page.getByTestId('service-show-shade').click();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.serviceView()))
    .toMatchObject({ overlay: 'data', trace: { sources: 1, idle: 1 } });
  await page.getByTestId('inspector-close').click();
  await expect.poll(() => page.evaluate(() => window.__cityDebug!.serviceView().trace)).toBeNull();
});

test('warns before placing a spring house that no power line reaches', async ({ page }) => {
  await start(page);
  await page.getByTestId('tool-category-utilities').click();
  await page.getByTestId('tool-springHouse').click();
  const p = await point(page, 6, 6);
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('construction-network-planned')).toContainText('sem energia');
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.serviceView().trace))
    .toMatchObject({ sources: 1, idle: 1 });
});
