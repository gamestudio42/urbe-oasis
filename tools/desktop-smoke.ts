/**
 * Opens the desktop window, founds a city, lays a road, checks audio, and saves.
 * Run after `pnpm desktop:build`. The browser dev server is not involved.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ElectronApplication, Page } from 'playwright';
import { DIST_HOST, DIST_SCHEME } from '../apps/desktop/src/distFiles';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopDir = path.join(root, 'apps', 'desktop');
const requireFromDesktop = createRequire(path.join(desktopDir, 'package.json'));
const electronPath = requireFromDesktop('electron') as string;

const requireFromTest = createRequire(
  createRequire(path.join(root, 'package.json')).resolve('@playwright/test/package.json'),
);
const { _electron: electron } = requireFromTest('playwright') as typeof import('playwright');

async function startCity(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('cityBuilder.tutorialDone', '1');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('seed-input').fill('desktop-smoke');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, undefined, {
    timeout: 30_000,
  });
}

async function main(): Promise<void> {
  const userData = mkdtempSync(path.join(tmpdir(), 'oasis-desktop-'));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      cwd: desktopDir,
      args: [desktopDir],
      env: { ...process.env, OASIS_USER_DATA: userData },
      timeout: 60_000,
    });
    const page = await app.firstWindow();
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('page:', message.text());
    });
    page.on('requestfailed', (request) => {
      console.error('failed', request.url(), request.failure()?.errorText);
    });
    try {
      await page.waitForURL(`${DIST_SCHEME}://${DIST_HOST}/**`, { timeout: 15_000 });
    } catch (error) {
      console.error('stuck on', page.url());
      console.error((await page.content()).slice(0, 1200));
      throw error;
    }
    await startCity(page);

    await page.waitForFunction(() => window.__cityDebug?.musicState().playing === true, undefined, {
      timeout: 10_000,
    });

    const area = await page.evaluate(() => window.__cityDebug?.findFlatArea(12, 4));
    if (!area) throw new Error('no flat area for a road');
    await page.evaluate(() => window.__cityDebug?.setSpeed(0));
    await page.evaluate(
      ([x, y]) => window.__cityDebug?.centerOnTile(x, y),
      [area.x + 6, area.y + 3],
    );
    await page.waitForTimeout(200);
    await page.getByTestId('tool-road').click();
    const from = await page.evaluate(
      ([x, y]) => window.__cityDebug?.tileToClient(x, y),
      [area.x, area.y + 3],
    );
    const to = await page.evaluate(
      ([x, y]) => window.__cityDebug?.tileToClient(x, y),
      [area.x + 11, area.y + 3],
    );
    if (!from || !to) throw new Error('road tiles are off screen');
    await page.mouse.move(from.x, from.y);
    await page.waitForTimeout(100);
    const hover = await page.evaluate(() => window.__cityDebug?.getHover());
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const road = await page.evaluate(
      ([x, y]) => window.__cityDebug?.getTile(x, y)?.road === true,
      [area.x + 5, area.y + 3],
    );
    if (!road) {
      throw new Error(
        `road was not placed from ${JSON.stringify(from)} to ${JSON.stringify(to)} hover ${JSON.stringify(hover)}`,
      );
    }

    await page.getByTestId('open-system').click();
    await page.getByTestId('save-now').click();
    await page.waitForFunction(
      async () => (await window.__cityDebug?.listSaves())?.length,
      undefined,
      {
        timeout: 10_000,
      },
    );
    console.log('desktop smoke ok');
  } finally {
    await app?.close();
    rmSync(userData, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
