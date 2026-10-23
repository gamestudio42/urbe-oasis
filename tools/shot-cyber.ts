import { chromium } from '@playwright/test';
import type { PlaceableKind } from '../packages/shared/src';

/**
 * Close-up comparison for the cyberpunk building art direction.
 *
 * Puts the drone port, the qanat and the cistern next to the civic buildings that were
 * rebuilt, and crops tight so the silhouettes can be compared side by side.
 */
const URL = process.argv[2] ?? 'http://localhost:5180/';
const OUT = process.argv[3] ?? 'test-results/cyber-compare.png';

async function main(): Promise<void> {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
  });
  await page.goto(URL);
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('seed-input').fill('cyber-compare');
  await page.getByTestId('size-select').selectOption('128');
  await page.getByTestId('terrain-water').fill('0');
  await page.getByTestId('terrain-hills').fill('0');
  await page.getByTestId('terrain-forest').fill('0');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);

  // Row 1: the cyberpunk references, then the civic buildings under review.
  const ROW: [PlaceableKind, number, number][] = [
    ['arcade', 0, 0],
    ['qanat', 4, 0],
    ['cistern', 7, 0],
    ['policeStation', 9, 0],
    ['fireStation', 12, 0],
    ['school', 15, 0],
    ['hospital', 18, 0],
  ];

  const placed = await page.evaluate(async (kinds) => {
    const debug = window.__cityDebug;
    if (!debug) return { error: 'no debug api' };
    const area = debug.findFlatArea(22, 6);
    if (!area) return { error: 'no flat area' };
    // A road along the top of the row: the drone port needs one to be placed.
    await debug.command({
      type: 'road',
      x0: area.x - 1,
      y0: area.y - 1,
      x1: area.x + 21,
      y1: area.y - 1,
    });
    const out: Record<string, boolean> = {};
    for (const [kind, dx, dy] of kinds) {
      out[kind] = (await debug.command({ type: 'place', kind, x: area.x + dx, y: area.y + dy })).ok;
    }
    debug.centerOnTile(area.x + 9, area.y + 2);
    const corners = [
      debug.tileToClient(area.x - 1, area.y - 1),
      debug.tileToClient(area.x + 21, area.y - 1),
      debug.tileToClient(area.x - 1, area.y + 5),
      debug.tileToClient(area.x + 21, area.y + 5),
    ].filter((p): p is { x: number; y: number } => p !== null);
    const minX = Math.min(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxX = Math.max(...corners.map((c) => c.x));
    const maxY = Math.max(...corners.map((c) => c.y));
    return {
      placed: out,
      box: {
        x: Math.max(0, minX - 30),
        y: Math.max(0, minY - 90),
        width: Math.min(1440, maxX - minX + 60),
        height: Math.min(900, maxY - minY + 150),
      },
    };
  }, ROW);

  console.log(JSON.stringify(placed, null, 2));
  await page.waitForTimeout(1500);
  if (placed && 'box' in placed && placed.box) {
    await page.screenshot({ path: OUT, clip: placed.box });
    console.log(`screenshot: ${OUT}`);
  }
  await browser.close();
}

void main();
