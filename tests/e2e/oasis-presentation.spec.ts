import { OASIS_SAVE_FORMAT, encodeSave } from '@city/shared';
import { SIM_PRESETS, droughtActive } from '@city/simulation';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
  });
});

test('the menu founds in one step and then opens on the latest city', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByTestId('main-menu');
  await menu.waitFor();
  await expect(menu).toHaveAttribute('data-view', 'new');
  await expect(page.getByTestId('city-name-input')).toBeVisible();
  // World options are folded until asked for.
  await expect(page.getByTestId('seed-input')).toBeHidden();
  await expect(page.getByTestId('terrain-water')).toBeHidden();
  await expect(page.getByTestId('menu-back')).toHaveCount(0);
  await page.getByTestId('menu-advanced-toggle').click();
  await expect(page.getByTestId('seed-input')).toBeVisible();
  await expect(page.getByTestId('terrain-water')).toHaveValue('0.04');
  await page.getByTestId('city-name-input').fill('Palmeiral');
  await page.getByTestId('seed-input').fill('presentation');
  await page.getByTestId('size-select').selectOption('64');
  await page.getByTestId('start-city').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());

  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('open-system').click();
  await page.getByTestId('back-to-menu').click();
  await expect(menu).toHaveAttribute('data-view', 'home');
  await expect(page.getByTestId('continue')).toHaveCount(1);
  await expect(page.getByTestId('continue')).toContainText('Continuar: Palmeiral');
  await expect(page.getByTestId('city-name-input')).toBeHidden();
  await expect(page.getByTestId('save-slot')).toHaveCount(1);
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-menu-home.png' });

  await page.getByTestId('menu-new-city').click();
  await expect(menu).toHaveAttribute('data-view', 'new');
  await expect(page.getByTestId('seed-input')).toBeHidden();
  await page.getByTestId('menu-back').click();
  await expect(menu).toHaveAttribute('data-view', 'home');
  await page.getByTestId('continue').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  expect(await page.evaluate(() => window.__cityDebug!.getStats()!.name)).toBe('Palmeiral');
});

test('separate volumes persist and the music follows a drought', async ({ page }) => {
  const run = SIM_PRESETS['oasis-journey']!.create('probe', 64);
  for (let m = 0; m < 48 && !droughtActive(run.engine); m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  expect(droughtActive(run.engine)).toBe(true);
  const save = JSON.stringify(
    encodeSave(
      run.engine.serialize(),
      { population: 0, funds: 0, savedAt: '2026-10-24T00:00:00.000Z' },
      { format: OASIS_SAVE_FORMAT },
    ),
  );
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await page.evaluate((text) => window.__cityDebug!.importText(text), save)).ok).toBe(true);
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await expect
    .poll(() => page.evaluate(() => window.__cityDebug!.musicState().mood))
    .toBe('scarce');

  await page.getByTestId('open-system').click();
  const music = page.getByTestId('volume-music');
  await expect(music).toHaveValue('100');
  await music.fill('40');
  await page.getByTestId('volume-effects').fill('70');
  await expect(page.getByTestId('volume-fields')).toContainText('40%');
  expect(
    await page.evaluate(() => [
      localStorage.getItem('oasis.audio.volume.music'),
      localStorage.getItem('oasis.audio.volume.effects'),
      localStorage.getItem('cityBuilder.volume.music'),
    ]),
  ).toEqual(['0.4', '0.7', null]);
  await page.getByTestId('sound-enabled').uncheck();
  await expect(page.getByTestId('volume-music')).toBeDisabled();
  await page.getByTestId('sound-enabled').check();
  if (!process.env.CI) await page.screenshot({ path: 'test-results/oasis-volumes.png' });

  await page.getByTestId('save-now').click();
  await expect(page.getByTestId('save-now')).toBeEnabled();
  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('continue').click();
  await page.waitForFunction(() => window.__cityDebug?.isReady());
  await page.getByTestId('open-system').click();
  await expect(page.getByTestId('volume-music')).toHaveValue('40');
  await expect(page.getByTestId('volume-effects')).toHaveValue('70');
});
