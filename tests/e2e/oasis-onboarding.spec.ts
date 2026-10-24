import { TICKS_PER_MONTH, ZoneDensity, ZoneType, type Command } from '@city/shared';
import { expect, test, type Page } from '@playwright/test';
import { dragTiles } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
    localStorage.removeItem('oasis.tutorial.founding.v1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
});

async function found(page: Page) {
  await page.getByTestId('seed-input').fill('oasis-founding');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
}

test('introduces survival even when the classic tutorial was completed', async ({ page }) => {
  await expect(page.getByTestId('terrain-water')).toHaveValue('0.04');
  await expect(page.getByTestId('terrain-forest')).toHaveValue('0.04');
  await expect(page.getByTestId('terrain-hills')).toHaveValue('0.15');
  await expect(page.getByTestId('terrain-rivers')).toHaveValue('0');
  await found(page);
  await expect(page.getByTestId('tutorial')).toContainText('Uma cidade ao redor da nascente');
  await expect(page.getByTestId('tutorial')).toContainText('1/10');
  await expect(page.getByTestId('speed-0')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('oasis-water')).toContainText('Sem consumidores');
  await expect(page.getByTestId('oasis-reserves')).toContainText('Sem cisterna');
  await page.getByTestId('oasis-water').click();
  await expect(page.getByTestId('oasis-water')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('oasis-shade').click();
  await expect(page.getByTestId('oasis-water')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('oasis-shade')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('oasis-shade').click();
  await page.evaluate(() => window.__cityDebug?.centerOnTile(5, 5));
  await page.getByTestId('focus-spring').click();
  const point = await page.evaluate(() => {
    const d = window.__cityDebug,
      p = d?.getStats()?.oasis?.spring;
    return p ? d?.tileToClient(p.x, p.y) : null;
  });
  expect(point?.x).toBeCloseTo(720, 0);
  expect(point?.y).toBeCloseTo(450, 0);
  const status = await page.getByTestId('oasis-status').boundingBox();
  const pause = await page.locator('.paused-banner').boundingBox();
  expect(status && pause).toBeTruthy();
  expect(pause!.y).toBeGreaterThan(status!.y + status!.height);
  await page.screenshot({ path: 'test-results/oasis-founding.png' });
});

test('guides a real settlement through water, shade and a powered cistern', async ({ page }) => {
  test.setTimeout(120_000);
  for (const key of ['water', 'hills', 'forest', 'rivers']) {
    await page.getByTestId(`terrain-${key}`).fill('0');
  }
  await found(page);
  await page.getByTestId('tutorial-next').click();
  await page.getByTestId('speed-0').click();
  await page.getByTestId('tutorial-tool-road').click();
  await expect(page.getByTestId('tool-road')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__cityDebug?.centerOnTile(8, 10));
  await dragTiles(page, [0, 10], [16, 10]);

  const send = async (commands: Command[], ticks = 4) => {
    const results = await page.evaluate(
      async ({ commands, ticks }) => {
        const d = window.__cityDebug!;
        const results = [];
        for (const command of commands) results.push(await d.command(command));
        await d.runTicks(ticks);
        return results;
      },
      { commands, ticks },
    );
    for (const result of results) expect(result.ok, JSON.stringify(result)).toBe(true);
  };
  await send(
    [
      {
        type: 'zone',
        zone: ZoneType.Residential,
        density: ZoneDensity.Light,
        x0: 8,
        y0: 9,
        x1: 10,
        y1: 9,
      },
      {
        type: 'zone',
        zone: ZoneType.Industrial,
        density: ZoneDensity.Light,
        x0: 12,
        y0: 11,
        x1: 14,
        y1: 11,
      },
      { type: 'place', kind: 'gasPlant', x: 4, y: 7 },
      { type: 'powerLine', x0: 5, y0: 8, x1: 13, y1: 11 },
    ],
    TICKS_PER_MONTH,
  );
  await expect(page.getByTestId('tutorial-tool-qanat')).toBeVisible();
  await page.getByTestId('tutorial-coverage').click();
  await expect(page.getByTestId('oasis-water')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('tutorial-coverage').click();
  await expect(page.getByTestId('oasis-water')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('tutorial-tool-qanat').click();
  await expect(page.getByTestId('tool-qanat')).toHaveAttribute('aria-pressed', 'true');
  await send([
    { type: 'place', kind: 'qanat', x: 4, y: 5 },
    { type: 'pipe', x0: 5, y0: 6, x1: 9, y1: 9 },
  ]);
  await expect(page.getByTestId('tutorial-tool-palm')).toBeVisible();
  await page.getByTestId('tutorial-coverage').click();
  await expect(page.getByTestId('oasis-shade')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('tutorial-coverage').click();
  await expect(page.getByTestId('oasis-shade')).toHaveAttribute('aria-pressed', 'false');
  await send(
    [
      { type: 'place', kind: 'palm', x: 11, y: 7 },
      { type: 'canal', x0: 11, y0: 8, x1: 10, y1: 9 },
    ],
    TICKS_PER_MONTH * 12,
  );
  await expect(page.getByTestId('tutorial-tool-cistern')).toBeVisible();
  await send([{ type: 'place', kind: 'cistern', x: 8, y: 6 }]);
  await expect(page.getByTestId('oasis-reserves')).toContainText('0%');
  await expect(page.getByTestId('tutorial-tool-cistern')).toBeVisible();
  await send([{ type: 'powerLine', x0: 8, y0: 7, x1: 8, y1: 8 }], TICKS_PER_MONTH);
  await expect(page.getByTestId('tutorial')).toContainText('Seu oásis está tomando forma');
  await expect(page.getByTestId('tutorial')).toContainText('10/10');
  const stats = await page.evaluate(() => window.__cityDebug?.getStats());
  expect(stats?.population).toBeGreaterThan(0);
  expect(stats?.funds).toBeGreaterThan(0);
  expect(stats?.oasis?.cisterns.charge).toBeGreaterThan(0);
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('tutorial')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('oasis.tutorial.founding.v1'))).toBe('1');
});
