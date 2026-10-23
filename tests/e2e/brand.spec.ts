import { expect, test, type Page } from '@playwright/test';
import { clientPointOf, pinE2ELocale, waitForCity } from './helpers';

const musicState = (page: Page) => page.evaluate(() => window.__cityDebug?.musicState());

async function openMenu(page: Page): Promise<void> {
  await pinE2ELocale(page);
  await page.addInitScript(() => localStorage.setItem('cityBuilder.tutorialDone', '1'));
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
}

async function foundCity(page: Page, name: string): Promise<void> {
  await page.getByTestId('city-name-input').fill(name);
  await page.getByTestId('seed-input').fill('brand');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('start-city').click();
  await waitForCity(page);
}

test('the share card points at the Open Graph image', async ({ page }) => {
  await page.goto('/');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/og\.jpg$/);
  const card = await page.locator('meta[name="twitter:card"]').getAttribute('content');
  expect(card).toBe('summary_large_image');
  const response = await page.request.get('/og.jpg');
  expect(response.ok()).toBe(true);
  await expect(page.locator('script[data-goatcounter]')).toHaveAttribute(
    'data-goatcounter',
    'https://gamestudio42.goatcounter.com/count',
  );
});

test('the page carries the Urbe name and icon, and boots before the menu', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page).toHaveTitle(/Urbe/);
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(icon).toBeTruthy();
  const response = await page.request.get(icon as string);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<svg');

  await expect(page.getByTestId('boot-screen')).toBeVisible();
  // While booting the menu is not mounted (checked in one synchronous read).
  const booting = await page.evaluate(() => ({
    step: document.querySelector('[data-testid="boot-screen"]')?.getAttribute('data-step'),
    menu: document.querySelector('[data-testid="main-menu"]') !== null,
  }));
  if (booting.step !== 'done') expect(booting.menu).toBe(false);
  await page.screenshot({ path: 'test-results/brand-boot.png' });

  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('boot-screen')).toHaveCount(0);
  await expect(page.locator('.menu-title')).toHaveAccessibleName(/Urbe/);
});

test('the menu shows a live city behind it', async ({ page }) => {
  await openMenu(page);
  expect(await page.evaluate(() => window.__cityDebug?.bootStep())).toBe('done');
  const stats = await page.evaluate(() => window.__cityDebug?.getStats());
  expect(stats?.population ?? 0).toBeGreaterThan(1000);
  await expect
    .poll(async () => (await page.evaluate(() => window.__cityDebug?.animationStats()))?.cars ?? 0)
    .toBeGreaterThan(0);
  // The background city keeps simulating and the camera drifts.
  const tick = stats?.tick ?? 0;
  const before = await page.evaluate(() => window.__cityDebug?.tileToClient(32, 32));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__cityDebug?.tileToClient(32, 32));
  expect((await page.evaluate(() => window.__cityDebug?.getStats()))?.tick ?? 0).toBeGreaterThan(
    tick,
  );
  expect(after).not.toEqual(before);
  // Events of the background city never reach the player.
  await expect(page.getByTestId('toasts').locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/brand-menu.png' });
});

test('music follows the screen, ducks on pause and remembers the toggle', async ({ page }) => {
  await openMenu(page);
  expect((await musicState(page))?.playing).toBe(false);

  // The first gesture starts the audio context and the menu track.
  await page.getByTestId('city-name-input').click();
  await expect.poll(async () => (await musicState(page))?.playing).toBe(true);
  expect(await musicState(page)).toMatchObject({ enabled: true, track: 'menu', ducked: false });

  // The speaker button mutes everything, music included.
  await page.getByTestId('menu-sound').click();
  await expect(page.getByTestId('menu-sound')).toHaveAttribute('aria-pressed', 'false');
  expect((await musicState(page))?.playing).toBe(false);
  await page.getByTestId('menu-sound').click();
  await expect.poll(async () => (await musicState(page))?.playing).toBe(true);

  await foundCity(page, 'Vila Sonora');
  expect(await musicState(page)).toMatchObject({ playing: true, track: 'city', ducked: false });

  // Pausing ducks the music and shows the overlay, which does not block the map.
  await page.getByTestId('speed-0').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await expect(page.locator('.paused-banner')).toContainText('Pausado');
  expect((await musicState(page))?.ducked).toBe(true);
  const flat = await page.evaluate(() => window.__cityDebug?.findFlatArea(1, 1));
  const { x, y } = flat as { x: number; y: number };
  const point = await clientPointOf(page, x, y);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => window.__cityDebug?.getSelected())).toEqual({ x, y });
  // The fade-in can take a while to start in the software-rendered headless browser.
  await expect(page.getByTestId('pause-overlay')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/brand-pause.png' });
  await page.keyboard.press('p');
  await expect(page.getByTestId('pause-overlay')).toHaveCount(0);
  expect((await musicState(page))?.ducked).toBe(false);

  // Turning the music off is persisted.
  await page.getByTestId('open-system').click();
  await page.getByTestId('music-enabled').uncheck();
  expect(await musicState(page)).toMatchObject({ enabled: false, playing: false });
  expect(await page.evaluate(() => localStorage.getItem('cityBuilder.music'))).toBe('0');

  // Back on the menu the player's city stays behind it, with the menu track.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('back-to-menu').click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  expect((await page.evaluate(() => window.__cityDebug?.getStats()))?.name).toBe('Vila Sonora');
  expect((await musicState(page))?.track).toBe('menu');

  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('city-name-input').click();
  expect(await musicState(page)).toMatchObject({ enabled: false, playing: false });
});
