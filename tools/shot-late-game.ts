import { chromium, type Browser, type Page } from '@playwright/test';
import { OASIS_SAVE_FORMAT, encodeSave } from '../packages/shared/src';
import { SIM_PRESETS } from '../packages/simulation/src';

/**
 * README stills for the late game: the era with its works, a caravan route and the phone layout.
 *
 * Plays the `oasis-journey` preset until its palace garden stands, loads that city into a running
 * build and shoots three frames.
 *
 *   pnpm exec tsx tools/shot-late-game.ts [url] [out-dir]
 */
const URL = process.argv[2] ?? 'http://localhost:5180/';
const OUT_DIR = process.argv[3] ?? 'docs/screenshots';

interface LateCity {
  save: string;
  garden: { x: number; y: number };
  bazaar: { x: number; y: number };
  stop: { x: number; y: number };
}

function lateCity(): LateCity {
  const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
  const e = run.engine;
  for (let m = 0; m < 240 && e.buildings.ofKind('palaceGarden').length === 0; m++) {
    e.runMonths(1);
    run.onMonth(e);
  }
  e.runMonths(2);
  const at = (kind: 'palaceGarden' | 'grandBazaar' | 'caravanStop') => {
    const b = e.buildings.ofKind(kind)[0];
    if (!b) throw new Error(`no ${kind}`);
    return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
  };
  const meta = { population: 0, funds: 0, savedAt: '2026-11-05T00:00:00.000Z' };
  return {
    save: JSON.stringify(encodeSave(e.serialize(), meta, { format: OASIS_SAVE_FORMAT })),
    garden: at('palaceGarden'),
    bazaar: at('grandBazaar'),
    stop: at('caravanStop'),
  };
}

async function open(browser: Browser, city: LateCity, phone = false): Promise<Page> {
  const page = await browser.newPage(
    phone
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          hasTouch: true,
          isMobile: true,
        }
      : { viewport: { width: 1440, height: 900 } },
  );
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'en');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.goto(URL);
  await page.getByTestId('main-menu').waitFor();
  const loaded = await page.evaluate((text) => window.__cityDebug!.importText(text), city.save);
  if (!loaded.ok) throw new Error('save did not load');
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 60_000,
  });
  return page;
}

/** Centres the camera, lets the street life walk for a while, then pauses. */
async function frame(page: Page, x: number, y: number, zoom: number, walk = 6000): Promise<void> {
  await page.evaluate(
    ({ x, y, zoom }) => {
      const debug = window.__cityDebug!;
      debug.centerOnTile(x, y);
      debug.setZoom(zoom);
      debug.setSpeed(1);
    },
    { x, y, zoom },
  );
  await page.waitForTimeout(walk);
  // A storm report may have opened the chronicle over the map.
  const close = page.getByTestId('chronicle-close');
  if (await close.isVisible()) await close.click();
}

async function main(): Promise<void> {
  const city = lateCity();
  console.log(JSON.stringify({ garden: city.garden, bazaar: city.bazaar, stop: city.stop }));
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // The era: the capital's title card beside the bazaar and the palace garden.
  const era = await open(browser, city);
  await frame(
    era,
    Math.round((city.garden.x + city.bazaar.x) / 2),
    Math.round((city.garden.y + city.bazaar.y) / 2),
    1.1,
  );
  await era.getByTestId('oasis-guide-toggle').click();
  await era.waitForTimeout(500);
  await era.screenshot({ path: `${OUT_DIR}/era.jpg`, type: 'jpeg', quality: 82 });
  await era.close();

  // A caravan route: camels on the avenue and a stop's riders in the inspector.
  const route = await open(browser, city);
  await frame(route, city.stop.x + 3, city.stop.y, 2.2, 14000);
  await route.getByTestId('tool-select').click();
  const p = (await route.evaluate(
    ({ x, y }) => window.__cityDebug!.tileToClient(x, y),
    city.stop,
  ))!;
  await route.mouse.click(p.x, p.y);
  await route.getByTestId('stop-riders').waitFor();
  // Follow a pack line on its way between stops.
  const camel = await route.evaluate(() =>
    window.__cityDebug!.hubSample().find((h) => h.kind === 'camel' && h.visible),
  );
  if (camel?.tileX !== undefined && camel.tileY !== undefined) {
    const at = { x: camel.tileX + 2, y: camel.tileY };
    await route.evaluate(({ x, y }) => window.__cityDebug!.centerOnTile(x, y), at);
  }
  await route.waitForTimeout(400);
  await route.screenshot({ path: `${OUT_DIR}/caravans.jpg`, type: 'jpeg', quality: 82 });
  await route.close();

  // Phones: the same city in portrait, with the two-row top bar and the touch dock.
  const phone = await open(browser, city, true);
  await frame(phone, city.bazaar.x - 6, city.bazaar.y + 4, 1.0);
  await phone.screenshot({ path: `${OUT_DIR}/phone.jpg`, type: 'jpeg', quality: 82 });
  await phone.close();

  await browser.close();
}

await main();
