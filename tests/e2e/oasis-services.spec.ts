import { encodeSave, OASIS_SAVE_FORMAT, type Command } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test } from '@playwright/test';

test('service landmarks retain their footprints, inspection and paused state at different zooms', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  const engine = createEngine({
    seed: 'oasis-service-architecture',
    size: 32,
    name: 'Oásis',
    ruleset: 'oasis',
    funds: 100_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  engine.disastersEnabled = false;
  const commands: Command[] = [
    { type: 'road', x0: 6, y0: 16, x1: 24, y1: 16 },
    { type: 'road', x0: 11, y0: 10, x1: 11, y1: 22 },
    { type: 'place', kind: 'fireStation', x: 12, y: 14 },
    { type: 'place', kind: 'waterPump', x: 16, y: 14 },
    { type: 'place', kind: 'gasPlant', x: 22, y: 14 },
    { type: 'powerLine', x0: 6, y0: 16, x1: 24, y1: 16 },
    { type: 'pipe', x0: 6, y0: 16, x1: 24, y1: 16 },
    { type: 'canal', x0: 6, y0: 16, x1: 24, y1: 16 },
    { type: 'place', kind: 'palm', x: 9, y: 17 },
    { type: 'place', kind: 'palm', x: 20, y: 17 },
    { type: 'zone', zone: 1, density: 1, x0: 6, y0: 13, x1: 10, y1: 15 },
    { type: 'zone', zone: 1, density: 1, x0: 12, y0: 17, x1: 15, y1: 19 },
    { type: 'zone', zone: 2, density: 1, x0: 16, y0: 17, x1: 19, y1: 19 },
  ];
  for (const command of commands)
    expect(engine.execute(command).ok, JSON.stringify(command)).toBe(true);
  engine.runMonths(8);
  const stats = engine.stats();
  const text = JSON.stringify(
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
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), text)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => window.__cityDebug!.centerOnTile(14, 16));
  const before = await page.evaluate(() => window.__cityDebug!.hash());
  for (const zoom of [1, 2]) {
    await page.evaluate((zoom) => window.__cityDebug!.setZoom(zoom), zoom);
    for (const [x, y, label] of [
      [12, 14, 'Corpo de bombeiros'],
      [13, 15, 'Corpo de bombeiros'],
      [16, 14, 'Bomba de água'],
      [17, 15, 'Bomba de água'],
    ] as const) {
      const point = await page.evaluate(({ x, y }) => window.__cityDebug!.tileToClient(x, y), {
        x,
        y,
      });
      await page.mouse.click(point!.x, point!.y);
      await expect(page.getByTestId('inspector')).toContainText(label);
      expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toEqual({ x, y });
    }
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 80);
    await page.screenshot({ path: `test-results/oasis-services-${zoom}x.png` });
  }
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(before);
  expect(errors).toEqual([]);
});
