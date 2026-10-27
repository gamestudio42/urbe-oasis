import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS } from '@city/simulation';
import { expect, test } from '@playwright/test';

/** The journey city a month after its caravan stops open. */
function routeCity(): { text: string; stop: { x: number; y: number } } {
  const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
  for (let m = 0; m < 120 && run.engine.buildings.ofKind('caravanStop').length === 0; m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  run.engine.runMonths(1);
  const stop = run.engine.buildings.ofKind('caravanStop')[0]!;
  expect(stop.occupancy).toBeGreaterThan(0);
  const text = JSON.stringify(
    encodeSave(
      run.engine.serialize(),
      { population: 0, funds: 0, savedAt: '2026-10-27T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  return { text, stop: { x: stop.x, y: stop.y } };
}

test('caravan stops sit in the transport tray and the inspector counts their riders', async ({
  page,
}) => {
  const { text, stop } = routeCity();
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((t) => window.__cityDebug!.importText(t), text)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());

  await page.getByTestId('tool-category-transport').click();
  const tool = page.getByTestId('tool-caravanStop');
  await expect(tool).toContainText('Parada de caravana');
  await expect(tool).toContainText('$300');
  await page.getByTestId('construction-close-transport').click();

  await page.evaluate(({ x, y }) => {
    window.__cityDebug!.centerOnTile(x, y);
    window.__cityDebug!.setZoom(2);
  }, stop);
  await page.getByTestId('tool-select').click();
  const p = (await page.evaluate(({ x, y }) => window.__cityDebug!.tileToClient(x, y), stop))!;
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('inspector')).toContainText('Parada de caravana');
  const riders = page.getByTestId('stop-riders');
  await expect(riders).toContainText('/ 400');
  await expect(riders).toContainText('Por mês');
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-transit.png' });
});
