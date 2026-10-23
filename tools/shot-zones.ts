import { chromium } from '@playwright/test';
import { OASIS_SAVE_FORMAT, ZONE_SPECS, encodeSave } from '@city/shared';
import { createEngine, oasisCapacity } from '@city/simulation';

/**
 * Side-by-side of the cyberpunk zone lots. Not part of the test suite: it needs the Neo Urbe
 * dev server and writes a cropped screenshot under test-results/.
 */
const URL = process.argv[2] ?? 'http://localhost:5180/';

type Kind = 'residential' | 'commercial' | 'industrial';

function saveText(): string {
  const engine = createEngine({
    seed: 'cyber-zones',
    size: 96,
    name: 'Lots',
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 500_000,
  });
  engine.disastersEnabled = false;
  const plant = (kind: Kind, x: number, y: number, level: number, variant: number) => {
    const classic = ZONE_SPECS[kind].capacity[level];
    engine.buildings.add({
      kind,
      x,
      y,
      w: 1,
      h: 1,
      level,
      capacity: classic ?? oasisCapacity(kind, level),
      occupancy: 1,
      condition: 100,
      age: 12,
      abandoned: false,
      emptyMonths: 0,
      variant,
      powered: true,
      watered: true,
      offline: 0,
      attractiveness: 1,
    });
  };

  // Short lots in the north, towers further south so the spires have sky above them.
  for (const variant of [0, 1, 2, 3]) {
    plant('residential', 20 + variant * 4, 16, 1, variant);
    plant('residential', 20 + variant * 4, 20, 2, variant);
    plant('commercial', 40 + variant * 4, 16, 1, variant);
    plant('commercial', 40 + variant * 4, 20, 2, variant);
    plant('industrial', 60 + variant * 4, 18, variant === 0 ? 2 : 4, variant);
    plant('residential', 20 + variant * 4, 40, variant < 2 ? 5 : 7, variant);
    plant('commercial', 40 + variant * 4, 40, variant < 2 ? 5 : 7, variant);
  }

  const stats = engine.stats();
  return JSON.stringify(
    encodeSave(
      engine.serialize(),
      { population: stats.population, funds: stats.funds, savedAt: '2026-01-01T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'en');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
  });
  await page.goto(URL);
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, { timeout: 60_000 });
  const loaded = await page.evaluate((text) => window.__cityDebug?.importText(text), saveText());
  console.log(JSON.stringify(loaded));
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true);
  const shots = [
    ['test-results/cyber-zones-low.png', 34, 18, 1.7],
    ['test-results/cyber-zones-industry.png', 66, 18, 1.8],
    ['test-results/cyber-zones-towers.png', 36, 40, 1.15],
  ] as const;
  for (const [path, x, y, zoom] of shots) {
    await page.evaluate(
      ([tx, ty, z]) => {
        window.__cityDebug?.setZoom(z as number);
        window.__cityDebug?.centerOnTile(tx as number, ty as number);
      },
      [x, y, zoom] as [number, number, number],
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path });
    console.log(path);
  }
  await browser.close();
}

void main();
