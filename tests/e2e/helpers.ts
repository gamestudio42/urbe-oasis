import { expect, type Page } from '@playwright/test';

export async function waitForCity(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__cityDebug?.isReady() === true, null, {
    timeout: 30_000,
  });
  // Give the renderer a few frames to draw the visible chunks.
  await page.waitForTimeout(500);
}

export interface StartOptions {
  /** Keep the onboarding tutorial (hidden by default so it does not cover the map). */
  tutorial?: boolean;
  difficulty?: 'easy' | 'normal' | 'hard';
  name?: string;
  size?: 64 | 96 | 128;
  hills?: number;
}

/**
 * Existing E2E assertions are written against the Portuguese catalog. Pin the locale
 * before any page script runs so `bootLocale` does not follow the browser language.
 */
export async function pinE2ELocale(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('cityBuilder.locale', 'pt-BR'));
}

/** Starts a new city from the main menu with a fixed seed. */
export async function startCity(
  page: Page,
  seed = 'e2e',
  options: StartOptions = {},
): Promise<void> {
  await pinE2ELocale(page);
  if (!options.tutorial) {
    await page.addInitScript(() => localStorage.setItem('cityBuilder.tutorialDone', '1'));
  }
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('seed-input').fill(seed);
  if (options.name) await page.getByTestId('city-name-input').fill(options.name);
  if (options.size) await page.getByTestId('size-select').selectOption(String(options.size));
  if (options.hills !== undefined) {
    await page.getByTestId('terrain-hills').fill(String(options.hills));
  }
  if (options.difficulty) {
    await page.getByTestId('difficulty-select').selectOption(options.difficulty);
  }
  await page.getByTestId('start-city').click();
  await waitForCity(page);
}

export async function clientPointOf(
  page: Page,
  x: number,
  y: number,
  center = true,
): Promise<{ x: number; y: number }> {
  if (center) {
    await page.evaluate(
      ([tx, ty]) => window.__cityDebug?.centerOnTile(tx as number, ty as number),
      [x, y],
    );
    await page.waitForTimeout(100);
  }
  const point = await page.evaluate(
    ([tx, ty]) => window.__cityDebug?.tileToClient(tx as number, ty as number),
    [x, y],
  );
  expect(point).toBeTruthy();
  return point as { x: number; y: number };
}

/** Drags with the left button from one tile to another (camera must already show both). */
export async function dragTiles(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  const a = await clientPointOf(page, from[0], from[1], false);
  const b = await clientPointOf(page, to[0], to[1], false);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

export async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const p = await clientPointOf(page, x, y, false);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(150);
}

export async function tile(page: Page, x: number, y: number) {
  return page.evaluate(
    ([tx, ty]) => window.__cityDebug?.getTile(tx as number, ty as number),
    [x, y],
  );
}
