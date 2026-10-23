import { expect, test } from '@playwright/test';
import { clientPointOf, startCity, tile } from './helpers';

test('pipe tool shows water pumps and wells underground', async ({ page }) => {
  await startCity(page, 'pipes');
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(8, 5));
  expect(area).toBeTruthy();
  const { x, y } = area as { x: number; y: number };

  const placed = await page.evaluate(
    async ([px, py]) => {
      const debug = window.__cityDebug;
      const pump = await debug?.command({ type: 'place', kind: 'waterPump', x: px, y: py });
      const well = await debug?.command({ type: 'place', kind: 'well', x: px + 3, y: py });
      const pipe = await debug?.command({
        type: 'pipe',
        x0: px + 2,
        y0: py + 3,
        x1: px + 6,
        y1: py + 3,
      });
      return { pump: pump?.ok, well: well?.ok, pipe: pipe?.ok };
    },
    [x, y],
  );
  expect(placed).toEqual({ pump: true, well: true, pipe: true });
  expect((await tile(page, x, y))?.buildingId).toBeTruthy();

  await clientPointOf(page, x + 2, y + 1);
  await page.getByTestId('tool-pipe').click();
  await expect(page.getByTestId('tool-pipe')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('open-system').click();
  await expect(page.getByTestId('underground-enabled')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('system-panel')).toBeHidden();

  await page.screenshot({ path: 'test-results/underground-pump.png' });
});
