import { expect, test, type Page } from '@playwright/test';

// Measure the real graph output, rather than trusting the engine's playing flag.
async function signal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const analyser = (window as Window & { oasisAudioProbe?: AnalyserNode }).oasisAudioProbe;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  });
}
const state = (page: Page) => page.evaluate(() => window.__cityDebug?.musicState());

test('Oasis music emits audio, follows the city, and persists independently', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('cityBuilder.locale', 'pt-BR');
    localStorage.setItem('oasis.tutorial.founding.v1', '1');
    // Sibling games are muted; Oasis must still start enabled.
    localStorage.setItem('cityBuilder.muted', '1');
    localStorage.setItem('cityBuilder.music', '0');
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output?: number,
      input?: number,
    ) {
      const result = Reflect.apply(
        connect,
        this,
        destination instanceof AudioParam ? [destination, output] : [destination, output, input],
      );
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        Reflect.apply(connect, this, [analyser]);
        (window as Window & { oasisAudioProbe?: AnalyserNode }).oasisAudioProbe = analyser;
      }
      return result;
    } as typeof AudioNode.prototype.connect;
  });
  await page.goto('/');
  await page.getByTestId('main-menu').waitFor();
  expect((await state(page))?.playing).toBe(false);
  await page.getByTestId('city-name-input').click();
  await expect.poll(() => signal(page)).toBeGreaterThan(0.001);
  expect(await state(page)).toMatchObject({ playing: true, track: 'menu' });
  // Existence of a signal is insufficient: measure after both startup fades through
  // the actual master bus, including the gaps between plucked notes.
  await page.waitForTimeout(2500);
  const samples: number[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await signal(page));
    await page.waitForTimeout(500);
  }
  expect(samples.reduce((sum, value) => sum + value, 0) / samples.length).toBeGreaterThan(0.008);
  expect(Math.min(...samples)).toBeGreaterThan(0.003);
  expect(Math.max(...samples)).toBeLessThan(0.5);

  await page.getByTestId('menu-sound').click();
  await expect.poll(() => signal(page)).toBe(0);
  await page.getByTestId('menu-sound').click();
  await expect.poll(() => signal(page)).toBeGreaterThan(0.001);
  await page.getByTestId('start-city').click();
  await page.getByTestId('hud').waitFor();
  await page.getByTestId('speed-0').click();
  expect(await state(page)).toMatchObject({ track: 'city', ducked: true });
  await page.getByTestId('hud-music').click();
  await expect.poll(() => signal(page)).toBeLessThan(0.00001);
  await page.getByTestId('hud-music').click();
  await expect.poll(() => signal(page)).toBeGreaterThan(0.001);
  expect(await state(page)).toMatchObject({ playing: true, ducked: true });
  await page.getByTestId('speed-1').click();
  expect((await state(page))?.ducked).toBe(false);
  await page.getByTestId('hud-music').click();
  await page.reload();
  await page.getByTestId('main-menu').waitFor();
  await page.getByTestId('city-name-input').click();
  expect(await state(page)).toMatchObject({ enabled: false, playing: false });
  expect(
    await page.evaluate(() => ({
      music: localStorage.getItem('oasis.audio.music'),
      sibling: localStorage.getItem('cityBuilder.music'),
      mute: localStorage.getItem('cityBuilder.muted'),
    })),
  ).toEqual({ music: '0', sibling: '0', mute: '1' });
  expect(errors).toEqual([]);
});
