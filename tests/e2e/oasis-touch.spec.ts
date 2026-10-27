import { encodeSave, OASIS_SAVE_FORMAT } from '@city/shared';
import { createEngine } from '@city/simulation';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** An empty flat Oasis city, so every tile is free to select or build on. */
function emptyCity(): string {
  const engine = createEngine({
    seed: 'touch',
    ruleset: 'oasis',
    size: 48,
    name: 'Oásis de Toque',
    funds: 100_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  return JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: 0, funds: 100_000, savedAt: '2026-10-27T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
}

async function open(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((t) => window.__cityDebug!.importText(t), emptyCity())).ok).toBe(
    true,
  );
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.evaluate(() => {
    window.__cityDebug!.centerOnTile(24, 24);
    window.__cityDebug!.setZoom(1.5);
  });
}

const client = (page: Page, x: number, y: number) =>
  page.evaluate(([tx, ty]) => window.__cityDebug!.tileToClient(tx!, ty!)!, [x, y]);

type Finger = { x: number; y: number; id: number };
type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';

/** Raw touch input through CDP: Playwright's touchscreen only taps with one finger. */
async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: TouchType, points: Finger[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    send,
    /** Moves the fingers from `from` to `to` in steps, then lifts them. */
    async drag(from: Finger[], to: Finger[], steps = 8) {
      await send('touchStart', from);
      for (let i = 1; i <= steps; i++) {
        const at = from.map((f, n) => ({
          id: f.id,
          x: f.x + ((to[n]!.x - f.x) * i) / steps,
          y: f.y + ((to[n]!.y - f.y) * i) / steps,
        }));
        await send('touchMove', at);
      }
      await send('touchEnd', []);
    },
  };
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b, String(locator)).toBeTruthy();
  return b!;
}

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [name, viewport] of [
  ['portrait', { width: 390, height: 844 }],
  ['small portrait', { width: 320, height: 568 }],
  ['landscape', { width: 844, height: 390 }],
  ['small landscape', { width: 667, height: 375 }],
] as const) {
  test.describe(`phone ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test('the controls fit without overlapping one another', async ({ page }) => {
      await open(page);
      const hud = page.getByTestId('hud');
      expect(await hud.evaluate((n) => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(0);
      for (const id of ['speed-0', 'speed-1', 'speed-3', 'open-budget', 'open-system'])
        await expect(page.getByTestId(id), id).toBeInViewport({ ratio: 1 });
      const hudBox = await box(hud);
      const status = await box(page.getByTestId('oasis-status'));
      const dock = await box(page.locator('.construction-dock'));
      const guide = await box(page.getByTestId('oasis-next-steps'));
      for (const [label, b] of [
        ['status', status],
        ['dock', dock],
        ['guide', guide],
      ] as const) {
        expect(b.x, label).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, label).toBeLessThanOrEqual(viewport.width);
        expect(b.y + b.height, label).toBeLessThanOrEqual(viewport.height);
        expect(overlaps(b, hudBox), `${label} under the top bar`).toBe(false);
      }
      expect(overlaps(status, dock)).toBe(false);
      expect(overlaps(guide, dock)).toBe(false);
      expect(overlaps(guide, status)).toBe(false);
      // Touch screens have no keyboard: no hotkey hints and no cursor readout.
      await expect(page.locator('.construction-selection kbd')).toBeHidden();
      await expect(page.getByTestId('readout')).toBeHidden();
      if (!process.env.CI)
        await page.screenshot({ path: `test-results/oasis-touch-${name.replace(' ', '-')}.png` });
    });
  });
}

test.describe('touch on the map', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap selects, one finger pans and two fingers pinch', async ({ page }) => {
    await open(page);
    const fingers = await touch(page);
    const tile = await client(page, 24, 24);
    await page.touchscreen.tap(tile.x, tile.y);
    expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toEqual({ x: 24, y: 24 });
    await page.keyboard.press('Escape');

    // One finger drags the map with it and selects nothing.
    await fingers.drag([{ ...tile, id: 1 }], [{ x: tile.x + 60, y: tile.y + 40, id: 1 }]);
    const moved = await client(page, 24, 24);
    expect(moved.x - tile.x).toBeCloseTo(60, -1);
    expect(moved.y - tile.y).toBeCloseTo(40, -1);
    expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toBeNull();

    // Spreading two fingers zooms in around them.
    const span = async () => {
      const a = await client(page, 20, 24);
      const b = await client(page, 28, 24);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const before = await span();
    await fingers.drag(
      [
        { x: 160, y: 420, id: 1 },
        { x: 230, y: 420, id: 2 },
      ],
      [
        { x: 120, y: 420, id: 1 },
        { x: 270, y: 420, id: 2 },
      ],
    );
    expect(await span()).toBeGreaterThan(before * 1.4);
    expect(await page.evaluate(() => window.__cityDebug!.getSelected())).toBeNull();
  });

  test('with the road tool one finger draws a road, and a second finger cancels it', async ({
    page,
  }) => {
    await open(page);
    const fingers = await touch(page);
    await page.getByTestId('tool-category-transport').click();
    await page.getByTestId('tool-road').click();
    await expect(page.getByTestId('tool-road')).toHaveAttribute('aria-pressed', 'true');
    // The tray covers part of the map; pick a row in the clear upper half.
    await page.evaluate(() => window.__cityDebug!.centerOnTile(22, 30));
    const road = (x: number, y: number) =>
      page.evaluate(([tx, ty]) => window.__cityDebug!.getTile(tx!, ty!)?.road, [x, y]);
    const from = await client(page, 20, 24);
    const to = await client(page, 24, 24);
    await fingers.drag([{ ...from, id: 1 }], [{ ...to, id: 1 }]);
    await expect.poll(() => road(22, 24)).toBe(true);
    expect(await road(20, 24)).toBe(true);
    expect(await road(24, 24)).toBe(true);

    // A second finger turns the stroke into a camera gesture: nothing is built.
    const other = await client(page, 20, 26);
    const otherEnd = await client(page, 24, 26);
    const { send } = fingers;
    await send('touchStart', [{ ...other, id: 1 }]);
    await send('touchMove', [
      { x: (other.x + otherEnd.x) / 2, y: (other.y + otherEnd.y) / 2, id: 1 },
    ]);
    await send('touchMove', [
      { x: (other.x + otherEnd.x) / 2, y: (other.y + otherEnd.y) / 2, id: 1 },
      { x: 300, y: 600, id: 2 },
    ]);
    await send('touchMove', [
      { ...otherEnd, id: 1 },
      { x: 320, y: 640, id: 2 },
    ]);
    await send('touchEnd', []);
    await page.waitForTimeout(500);
    for (let x = 20; x <= 24; x++) expect(await road(x, 26), `road at ${x},26`).toBe(false);
  });
});
