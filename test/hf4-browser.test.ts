/** Current UI smoke through the public diagnostic control; no screenshots or hosted writes. */
import { PEOPLE_ACROSS_GAMES } from '@adam0white/lab-kit';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { launchBrowser } from './browser.ts';

for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])
  it(`plays and reloads a current HF4 card at ${viewport.width}×${viewport.height}`, async () => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
    await server.listen();
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ viewport });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls!.local[0]!);
      expect(PEOPLE_ACROSS_GAMES).toBe('People across games');
      await page.locator('#menu').click();
      await expect(
        page.getByRole('link', { name: PEOPLE_ACROSS_GAMES, exact: true }).getAttribute('href'),
      ).resolves.toBe('https://human.adamwhite.work/lab/people/');
      await page.locator('#bp-close').click();
      await page.evaluate(() => {
        window.__murmur.fast = true;
        window.__murmur.start(17, '0.10.0');
      });
      await page.locator('#hush').waitFor();
      const first = await page.evaluate(() => window.__murmur.view()!.id);
      await page.evaluate(() => {
        const v = window.__murmur.view()!;
        window.__murmur.say(v.options[0]!.id);
      });
      await page.waitForFunction((id) => Boolean(window.__murmur.state?.chosen[id]), first);
      await page.evaluate(() => window.__murmur.flushSave());
      await page.reload();
      await page.locator('#cont').click();
      await page.waitForFunction(() => window.__murmur.state?.version === '0.10.0');
      expect(await page.evaluate((id) => window.__murmur.state?.chosen[id], first)).toBeTruthy();
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.close();
    }
  }, 120000);

it('reconstructs the exact synchronous checkpoint when full compression fails, and refuses a changed HF hash', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.evaluate(() => {
      Object.defineProperty(window, 'CompressionStream', {
        configurable: true,
        value: class {
          constructor() {
            throw new Error('fixture compression failure');
          }
        },
      });
      window.__murmur.fast = true;
      window.__murmur.start(18, '0.10.0');
    });
    await page.locator('#hush').waitFor();
    const first = await page.evaluate(() => window.__murmur.view()!.id);
    await page.evaluate(() => window.__murmur.say(window.__murmur.view()!.options[0]!.id));
    await page.evaluate(() => window.__murmur.flushSave());
    const receipt = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('murmur-save-v1')!);
      return {
        format: saved.format,
        hash: saved.hfHash,
        chosen: saved.host.chosen,
        checkpoint: JSON.stringify(saved),
      };
    });
    expect(receipt.format).toBe('murmur-replay-save/1');
    expect(receipt.hash).toMatch(/^[a-f0-9]{64}$/);
    await page.reload();
    await page.locator('#cont').click();
    await page.waitForFunction(() => window.__murmur.state?.seed === 18);
    expect(await page.evaluate((id) => window.__murmur.state?.chosen[id], first)).toBe(receipt.chosen[first]);
    await page.goto('about:blank');
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.locator('.title').waitFor();
    await page.evaluate((checkpoint) => {
      const saved = JSON.parse(checkpoint);
      saved.hfHash = '0'.repeat(64);
      localStorage.setItem('murmur-save-v1', JSON.stringify(saved));
    }, receipt.checkpoint);
    await page.reload();
    await page.locator('.title').waitFor();
    expect(await page.locator('#cont').count()).toBe(0);
    expect(await page.locator('.title').textContent()).toContain('could not be read');
  } finally {
    await browser.close();
    await server.close();
  }
}, 120000);
