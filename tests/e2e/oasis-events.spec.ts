import { encodeSave, OASIS_SAVE_FORMAT, TICKS_PER_MONTH } from '@city/shared';
import { buildTown, createEngine } from '@city/simulation';
import { expect, test, type Page } from '@playwright/test';

/** Save immediately before a real seeded storm. No visual-event injection or changed odds. */
function beforeStorm() {
  const engine = createEngine({
    seed: 'oasis-chronicle',
    size: 64,
    name: 'Dunas',
    ruleset: 'oasis',
    funds: 200_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  engine.disastersEnabled = false;
  buildTown(engine);
  const market = engine.execute({ type: 'place', kind: 'caravanserai', x: 38, y: 21 });
  if (!market.ok) throw new Error('The storm fixture requires an exposed service');
  engine.runMonths(18);
  engine.takeEvents();
  for (let month = 0; month < 100; month++) {
    const snapshot = engine.serialize();
    const stats = engine.stats();
    engine.runMonths(1);
    const event = engine.takeEvents().find((e) => e.type === 'sandstorm' && !e.blocked);
    if (event?.type === 'sandstorm')
      return {
        event,
        text: JSON.stringify(
          encodeSave(
            snapshot,
            {
              population: stats.population,
              funds: stats.funds,
              savedAt: '2026-10-23T00:00:00.000Z',
            },
            { format: OASIS_SAVE_FORMAT },
          ),
        ),
      };
  }
  throw new Error('The seeded fixture did not produce a storm');
}

let fixture: ReturnType<typeof beforeStorm>;
test.beforeAll(() => {
  fixture = beforeStorm();
});

async function load(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.animations', '1');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect(
    (await page.evaluate((text) => window.__cityDebug!.importText(text), fixture.text)).ok,
  ).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate((ticks) => window.__cityDebug!.runTicks(ticks), TICKS_PER_MONTH);
}

test('a real storm has a report, map location, bounded effects and a non-destructive response', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await load(page);
  await expect(page.getByTestId('chronicle-report')).toHaveAttribute('data-kind', 'storm');
  await expect(page.getByTestId('chronicle-report')).toContainText('Areia sobre a cidade');
  await page.getByTestId('chronicle-locate').click();
  expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toEqual({
    x: fixture.event.x,
    y: fixture.event.y,
  });
  await expect(page.getByTestId('hub-status')).not.toContainText('sem energia');
  const point = await page.evaluate(
    (p) => window.__cityDebug!.tileToClient(p.x, p.y),
    fixture.event,
  );
  expect(point?.x).toBeCloseTo(720, 0);
  expect(point?.y).toBeCloseTo(450, 0);
  await page.getByTestId('speed-1').click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__cityDebug!.oasisEffectStats())).intensity)
    .toBeGreaterThan(0.7);
  await page.getByTestId('speed-0').click();
  const effect = await page.evaluate(() => window.__cityDebug!.oasisEffectStats());
  expect(effect.signals).toBeGreaterThan(0);
  expect(effect.signals).toBeLessThanOrEqual(8);
  const journal = await page.getByTestId('oasis-chronicle').boundingBox();
  const inspector = await page.locator('.inspector').boundingBox();
  const resources = await page.getByTestId('oasis-status').boundingBox();
  expect(journal && inspector && resources).toBeTruthy();
  expect(journal!.x + journal!.width).toBeLessThan(inspector!.x);
  expect(journal!.y).toBeGreaterThan(resources!.y + resources!.height);
  await page.screenshot({ path: 'test-results/oasis-storm.png' });
  const hash = await page.evaluate(() => window.__cityDebug!.hash());
  // At speed 1 a month closes every six seconds; under load the wait above can span one, and a
  // newer moment then leads the report. Pick the storm from the history before acting on it.
  await page.getByTestId('chronicle-history').click();
  await page
    .getByTestId('chronicle-entries')
    .getByRole('button')
    .filter({ hasText: 'Areia sobre a cidade' })
    .filter({ hasText: `${fixture.event.x}, ${fixture.event.y}` })
    .first()
    .click();
  await expect(page.getByTestId('chronicle-report')).toHaveAttribute('data-kind', 'storm');
  await page.getByTestId('chronicle-tool').click();
  await expect(page.getByTestId('tool-windbreak')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('chronicle-close').click();
  await expect(page.getByTestId('chronicle-report')).toBeHidden();
  await page.getByTestId('chronicle-history').click();
  await expect(page.getByTestId('chronicle-report')).toBeVisible();
  expect(await page.evaluate(() => window.__cityDebug!.hash())).toBe(hash);
  expect((await page.evaluate(() => window.__cityDebug!.oasisEffectStats())).age).toBe(effect.age);
  await page.getByTestId('open-system').click();
  await page.getByTestId('animations-enabled').uncheck();
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.oasisEffectStats().signals))
    .toBe(0);
  await page.keyboard.press('Escape');
  expect(
    (await page.evaluate((text) => window.__cityDebug!.importText(text), fixture.text)).ok,
  ).toBe(true);
  await expect(page.getByTestId('chronicle-report')).toBeHidden();
  await page.getByTestId('chronicle-history').click();
  await expect(page.getByTestId('chronicle-entries')).toContainText('O deserto está tranquilo');
});

test('reduced motion retains the actionable report without weather or pulsing markers', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  await expect(page.getByTestId('chronicle-report')).toHaveAttribute('data-kind', 'storm');
  expect(await page.evaluate(() => window.__cityDebug!.oasisEffectStats().signals)).toBe(0);
  await page.getByTestId('chronicle-locate').click();
  expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toEqual({
    x: fixture.event.x,
    y: fixture.event.y,
  });
});
