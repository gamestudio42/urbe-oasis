import { chromium, type Page } from '@playwright/test';
import { ZoneDensity, ZoneType, type Command } from '../packages/shared/src';

/**
 * README stills for the underground network and three thematic maps.
 *
 * Founds a flat neon town, grows it, then shoots the underground view (pipes, pumps and canal),
 * the data map, health coverage and pollution. The panel is closed before each frame.
 *
 *   pnpm exec tsx tools/shot-maps.ts [url] [out-dir]
 */
const URL = process.argv[2] ?? 'http://localhost:5180/';
const OUT_DIR = process.argv[3] ?? 'docs/screenshots';

function town(): Command[] {
  const avenueY = 20;
  const commands: Command[] = [];
  const road = (x0: number, y0: number, x1: number, y1: number) =>
    commands.push({ type: 'road', x0, y0, x1, y1 });
  const zone = (zone: ZoneType, x0: number, y0: number, x1: number, y1: number) =>
    commands.push({ type: 'zone', zone, density: ZoneDensity.Dense, x0, y0, x1, y1 });

  road(0, avenueY, 40, avenueY);
  for (let x = 6; x <= 40; x += 6) road(x, avenueY - 7, x, avenueY + 7);
  for (let x = 7; x + 4 <= 40; x += 6) zone(ZoneType.Residential, x, avenueY - 6, x + 4, avenueY - 1);
  zone(ZoneType.Commercial, 7, avenueY + 1, 23, avenueY + 3);
  zone(ZoneType.Industrial, 25, avenueY + 1, 35, avenueY + 6);
  zone(ZoneType.Commercial, 7, avenueY + 4, 23, avenueY + 6);
  commands.push({ type: 'place', kind: 'coalPlant', x: 44, y: avenueY + 2 });
  commands.push({ type: 'powerLine', x0: 36, y0: avenueY + 3, x1: 43, y1: avenueY + 3 });
  for (let p = 0; p < 3; p++) {
    commands.push({ type: 'place', kind: 'waterPump', x: 44, y: avenueY - 4 - 2 * p });
  }
  commands.push({ type: 'powerLine', x0: 44, y0: avenueY - 2, x1: 44, y1: avenueY + 1 });
  commands.push({ type: 'pipe', x0: 43, y0: avenueY - 3, x1: 7, y1: avenueY - 3 });
  commands.push({ type: 'pipe', x0: 7, y0: avenueY + 2, x1: 43, y1: avenueY + 2 });
  commands.push({ type: 'pipe', x0: 43, y0: avenueY - 3, x1: 43, y1: avenueY + 2 });
  commands.push({ type: 'canal', x0: 7, y0: avenueY - 3, x1: 43, y1: avenueY - 3 });
  commands.push({ type: 'canal', x0: 7, y0: avenueY + 2, x1: 47, y1: avenueY + 2 });
  commands.push({ type: 'canal', x0: 43, y0: avenueY - 2, x1: 43, y1: avenueY + 1 });
  commands.push({ type: 'place', kind: 'springHouse', x: 47, y: avenueY + 2 });
  commands.push({ type: 'place', kind: 'policeStation', x: 4, y: avenueY - 3 });
  commands.push({ type: 'place', kind: 'hospital', x: 4, y: avenueY + 2 });
  commands.push({ type: 'setDisasters', enabled: false });
  return commands;
}

async function found(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
  });
  await page.goto(URL);
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('seed-input').fill('map-gallery');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('difficulty-select').selectOption('easy');
  await page.getByTestId('terrain-water').fill('0');
  await page.getByTestId('terrain-hills').fill('0');
  await page.getByTestId('terrain-forest').fill('0');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 60_000,
  });
}

async function frame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window.__cityDebug;
    debug?.centerOnTile(24, 18);
    debug?.setZoom(0.55);
    debug?.setSpeed(0);
  });
  await page.waitForTimeout(600);
}

/** Opens a panel, clicks a control, then dismisses the panel so the map is unobstructed. */
async function choose(page: Page, openId: string, controlId: string): Promise<void> {
  await page.getByTestId(openId).click();
  const control = page.getByTestId(controlId);
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await found(page);

  const built = await page.evaluate(async (commands) => {
    const debug = window.__cityDebug;
    if (!debug) return { error: 'no debug api' };
    const failed: string[] = [];
    for (const command of commands) {
      const result = await debug.command(command);
      if (!result.ok) failed.push(`${command.type} ${result.reason ?? ''}`);
    }
    await debug.runTicks(24 * 120);
    // An intrusion mutes the hall for half a month. Step past it so the still shows supply.
    for (let step = 0; step < 4 && (debug.getStats()?.oasis?.data.supply ?? 0) === 0; step++) {
      await debug.runTicks(120);
    }
    debug.setSpeed(0);
    const stats = debug.getStats();
    return {
      failed,
      population: stats?.population ?? 0,
      funds: stats?.funds ?? 0,
      power: stats?.power.served ?? 0,
      water: stats?.water.served ?? 0,
      data: stats?.oasis?.data ?? null,
      hall: debug.getTile(47, 22),
      canal: debug.getTile(20, 17),
      industry: debug.getTile(30, 23),
      hospital: debug.getTile(5, 23),
    };
  }, town());
  console.log(JSON.stringify(built, null, 2));
  if (!built || 'error' in built) throw new Error('city did not start');
  if (built.failed.length > 0) throw new Error(`commands failed: ${built.failed.join('; ')}`);

  await frame(page);
  await choose(page, 'open-system', 'underground-enabled');
  await page.screenshot({
    path: `${OUT_DIR}/underground.jpg`,
    type: 'jpeg',
    quality: 82,
  });

  await choose(page, 'open-system', 'underground-enabled');
  await choose(page, 'open-overlays', 'overlay-data');
  await page.screenshot({ path: `${OUT_DIR}/data.jpg`, type: 'jpeg', quality: 82 });

  await choose(page, 'open-overlays', 'overlay-health');
  await page.screenshot({ path: `${OUT_DIR}/coverage.jpg`, type: 'jpeg', quality: 82 });

  await choose(page, 'open-overlays', 'overlay-pollution');
  await page.screenshot({ path: `${OUT_DIR}/pollution.jpg`, type: 'jpeg', quality: 82 });

  await browser.close();
  console.log(`screenshots in ${OUT_DIR}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
