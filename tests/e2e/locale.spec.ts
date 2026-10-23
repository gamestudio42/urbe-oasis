import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

test('defaults to English from the browser and keeps a manual choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cityBuilder.tutorialDone', '1'));
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();

  await expect(page.getByTestId('locale-select')).toHaveValue('en');
  await expect(page.getByTestId('start-city')).toHaveText('Found city');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  expect(await page.evaluate(() => localStorage.getItem('cityBuilder.locale'))).toBe('en');

  await page.getByTestId('locale-select').selectOption('es');
  await expect(page.getByTestId('start-city')).toHaveText('Fundar ciudad');
  await expect(page.getByTestId('locale-select')).toHaveValue('es');

  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await expect(page.getByTestId('locale-select')).toHaveValue('es');
  await expect(page.getByTestId('start-city')).toHaveText('Fundar ciudad');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('es');
  expect(await page.evaluate(() => localStorage.getItem('cityBuilder.locale'))).toBe('es');
});
