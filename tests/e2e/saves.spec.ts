import { readFileSync } from 'node:fs';
import { SAVE_VERSION } from '@city/shared';
import { expect, test, type Page } from '@playwright/test';
import { startCity, waitForCity } from './helpers';

async function buildSomething(page: Page, ticks: number): Promise<void> {
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  await page.evaluate(async (t) => {
    const debug = window.__cityDebug;
    const area = debug?.findFlatArea(12, 4);
    if (!debug || !area) throw new Error('no flat area');
    const { x, y } = area;
    await debug.command({ type: 'road', x0: x, y0: y + 3, x1: x + 11, y1: y + 3 });
    await debug.command({ type: 'zone', zone: 1, density: 1, x0: x, y0: y, x1: x + 11, y1: y + 2 });
    await debug.runTicks(t);
  }, ticks);
}

const hash = (page: Page) => page.evaluate(() => window.__cityDebug?.hash());

test('saves to IndexedDB and continues the same city after a reload', async ({ page }) => {
  await startCity(page, 'save-e2e');
  await buildSomething(page, 240);
  const before = await hash(page);

  await page.getByTestId('open-system').click();
  await page.getByTestId('save-now').click();
  await expect(page.getByTestId('toasts')).toContainText('Cidade salva.');

  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await expect(page.getByTestId('continue')).toContainText('Nova Cidade');
  const slot = page.locator('[data-slot="city:save-e2e:Nova Cidade"]');
  await expect(slot).toBeVisible();
  await page.screenshot({ path: 'test-results/saves-menu.png' });
  await slot.getByTestId('load-slot').click();
  await waitForCity(page);
  await expect(page.getByTestId('toasts')).toContainText('Nova Cidade carregada.');
  await expect(page.locator('.paused-banner')).toBeVisible();
  expect(await hash(page)).toBe(before);
});

test('exports a file, rejects corrupted files and imports it back', async ({ page }) => {
  await startCity(page, 'export-e2e');
  await buildSomething(page, 120);
  const before = await hash(page);

  await page.getByTestId('open-system').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-file').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.city\.json$/);
  const text = readFileSync(await download.path(), 'utf8');
  expect(JSON.parse(text)).toMatchObject({ format: 'city-builder-save', version: SAVE_VERSION });

  const input = page.getByTestId('import-file-game-input');
  const file = (name: string, content: string) => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await input.setInputFiles(
    file('edited.city.json', text.replace('"monthsInDebt":0', '"monthsInDebt":1')),
  );
  await expect(page.getByTestId('toasts')).toContainText('checksum inválido');
  await input.setInputFiles(file('truncated.city.json', text.slice(0, 2000)));
  await expect(page.getByTestId('toasts')).toContainText('não é um JSON válido');
  await input.setInputFiles(file('other.json', '{"hello": "world"}'));
  await expect(page.getByTestId('toasts')).toContainText('não é um save');
  // Failed imports leave the running city untouched.
  expect(await hash(page)).toBe(before);

  await page.evaluate(() => window.__cityDebug?.runTicks(240));
  expect(await hash(page)).not.toBe(before);
  await input.setInputFiles(file('good.city.json', text));
  await expect(page.getByTestId('toasts')).toContainText('carregada');
  expect(await hash(page)).toBe(before);
});

test('reports a full storage quota instead of failing silently', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: [unknown, IDBValidKey?]
    ) {
      if (this.name === 'data') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await startCity(page, 'quota-e2e');
  await page.getByTestId('open-system').click();
  await page.getByTestId('save-now').click();
  await expect(page.getByTestId('toasts')).toContainText('Sem espaço para salvar');
  expect(await page.evaluate(() => window.__cityDebug?.listSaves())).toEqual([]);
});

test('disasters can be triggered from the system panel', async ({ page }) => {
  await startCity(page, 'disasters-e2e');
  await page.evaluate(() => window.__cityDebug?.setSpeed(0));
  await page.getByTestId('open-system').click();
  await page.getByTestId('system-scenarios').locator('summary').click();
  await page.getByTestId('trigger-blackout').click();
  await page.getByTestId('confirm-disaster').click();
  await expect(page.getByTestId('toasts')).toContainText('não pode acontecer agora');
  await page.getByTestId('trigger-crisis').click();
  await page.getByTestId('confirm-disaster').click();
  await expect(page.getByTestId('hud-alerts')).toContainText('Crise econômica');

  const forest = await page.evaluate(() => {
    const debug = window.__cityDebug;
    for (let y = 40; y < 90; y++) {
      for (let x = 40; x < 90; x++) if ((debug?.getTile(x, y)?.trees ?? 0) > 0) return { x, y };
    }
    return null;
  });
  expect(forest).toBeTruthy();
  const { x, y } = forest as { x: number; y: number };
  await page.evaluate(([fx, fy]) => window.__cityDebug?.triggerDisaster('fire', fx, fy), [x, y]);
  await page.evaluate(() => window.__cityDebug?.runTicks(4));
  await expect(page.getByTestId('hud-fires')).toBeVisible();
  await page.screenshot({ path: 'test-results/disasters.png' });
});
