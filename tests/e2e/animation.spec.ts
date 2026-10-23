import { expect, test, type Page } from '@playwright/test';
import { clientPointOf, startCity } from './helpers';

const stats = (page: Page) =>
  page.evaluate(
    () =>
      window.__cityDebug?.animationStats() ?? {
        cars: 0,
        trucks: 0,
        puffs: 0,
        sparkles: 0,
        boats: 0,
        planes: 0,
        drones: 0,
      },
  );

test('cars, smoke, water glints and fire engines animate the city', async ({ page }) => {
  test.setTimeout(150_000);
  await startCity(page, 'animation', { size: 64, hills: 0, difficulty: 'easy' });
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(16, 10));
  expect(area).toBeTruthy();
  const { x, y } = area as { x: number; y: number };

  // A street with homes, shops, industry, a coal plant and a fire station.
  await page.evaluate(
    async ([ax, ay]) => {
      const d = window.__cityDebug;
      if (!d) throw new Error('no debug api');
      const ok = (r: { ok: boolean }) => {
        if (!r.ok) throw new Error('command failed');
      };
      ok(await d.command({ type: 'road', x0: ax, y0: ay + 5, x1: ax + 15, y1: ay + 5 }));
      ok(
        await d.command({
          type: 'zone',
          x0: ax,
          y0: ay + 2,
          x1: ax + 11,
          y1: ay + 4,
          zone: 1,
          density: 1,
        }),
      );
      ok(
        await d.command({
          type: 'zone',
          x0: ax,
          y0: ay + 6,
          x1: ax + 5,
          y1: ay + 8,
          zone: 2,
          density: 1,
        }),
      );
      ok(
        await d.command({
          type: 'zone',
          x0: ax + 6,
          y0: ay + 6,
          x1: ax + 11,
          y1: ay + 8,
          zone: 3,
          density: 1,
        }),
      );
      ok(await d.command({ type: 'place', kind: 'coalPlant', x: ax + 12, y: ay + 2 }));
      ok(await d.command({ type: 'place', kind: 'fireStation', x: ax + 12, y: ay + 6 }));
      await d.runTicks(120 * 18);
    },
    [x, y] as const,
  );
  await clientPointOf(page, x + 8, y + 5);

  // Running at 1×: cars follow the simulated traffic and the plant smokes.
  await page.getByTestId('speed-1').click();
  await expect.poll(async () => (await stats(page)).cars, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await stats(page)).puffs).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/animation.png' });

  // Paused: every vehicle stays where it is.
  await page.getByTestId('speed-0').click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__cityDebug?.vehicleSample() ?? []);
  expect(before.length).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cityDebug?.vehicleSample() ?? [])).toEqual(before);

  // A fire in a covered home brings a fire engine from the station. The back row is
  // three tiles from the road, past tileSpread, so it has no fireCover and no truck.
  const home = await page.evaluate(
    ([ax, ay]) => {
      for (let ty = ay + 4; ty >= ay + 2; ty--) {
        for (let tx = ax; tx <= ax + 11; tx++) {
          const tile = window.__cityDebug?.getTile(tx, ty);
          if (tile?.buildingId && tile.fireCover > 0) return { x: tx, y: ty };
        }
      }
      return null;
    },
    [x, y] as const,
  );
  expect(home).toBeTruthy();
  await page.getByTestId('speed-1').click();
  const fire = await page.evaluate(
    ([hx, hy]) => window.__cityDebug?.triggerDisaster('fire', hx, hy),
    [home!.x, home!.y] as const,
  );
  expect(fire?.ok).toBe(true);
  await page.evaluate(([hx, hy]) => window.__cityDebug?.reportFire(hx, hy), [
    home!.x,
    home!.y,
  ] as const);
  await expect.poll(async () => (await stats(page)).trucks, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/animation-fire.png' });

  // Glints on the water.
  const water = await page.evaluate(() => {
    const d = window.__cityDebug;
    for (let ty = 0; ty < 64; ty++) {
      for (let tx = 0; tx < 64; tx++)
        if (d?.getTile(tx, ty)?.terrain === 0) return { x: tx, y: ty };
    }
    return null;
  });
  if (water) {
    await clientPointOf(page, water.x, water.y);
    await expect.poll(async () => (await stats(page)).sparkles).toBeGreaterThan(0);
  }

  // Switched off from the system panel, and remembered.
  await page.getByTestId('open-system').click();
  await page.getByTestId('animations-enabled').uncheck();
  await expect
    .poll(() => stats(page))
    .toEqual({ cars: 0, trucks: 0, puffs: 0, sparkles: 0, boats: 0, planes: 0, drones: 0 });
  expect(await page.evaluate(() => localStorage.getItem('cityBuilder.animations'))).toBe('0');
});
