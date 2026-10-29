import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { cloneState } from '../src/sim/game.ts';
import { validateRun } from '../src/ui/one-cast.ts';
import { chooseSeed, launchBrowser } from './browser.ts';

it('renders quiet choices without sending; ordinary Submit keeps recording-off privacy; reading slows and menu pauses', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      const captured: unknown[] = [];
      (window as unknown as { mockFeedback: unknown[] }).mockFeedback = captured;
      window.fetch = async (input, init) => {
        if (String(input).startsWith('https://human.adamwhite.work/lab/api/')) {
          if (init?.body instanceof Blob) {
            const text = await new Response(
              init.body.stream().pipeThrough(new DecompressionStream('gzip')),
            ).text();
            captured.push(JSON.parse(text));
          }
          return Response.json({ ok: true, id: 'mock-note' });
        }
        return realFetch(input, init);
      };
    });
    const requests = () =>
      page.evaluate(() => (window as unknown as { mockFeedback: unknown[] }).mockFeedback);
    await page.goto(`${server.resolvedUrls!.local[0]}`);
    await chooseSeed(page, 17);
    await page.locator('#next-edition').check();
    await page.locator('#new').click();
    expect(await page.evaluate(() => window.__murmur.state?.version)).toBe('0.9.1');
    await page.locator('#hush').waitFor();
    const raw = await page.evaluate(async () => {
      const { cloneState } = await new Function('return import("/src/sim/game.ts")')();
      return cloneState(window.__murmur.state!);
    });
    expect(JSON.parse(JSON.stringify(cloneState(await validateRun(raw))))).toEqual(raw);
    await page.locator('#info').click();
    const progress = await page.locator('#timer').getAttribute('stroke-dasharray');
    const minute = await page.evaluate(() => window.__murmur.state!.minute);
    await page.waitForTimeout(1200);
    // Remaining fractional minute is observed through the UI rate; a full minute takes20seconds while reading.
    expect(await page.locator('#state-words').innerText()).not.toContain('paused');
    expect(await page.evaluate(() => window.__murmur.state!.minute)).toBeGreaterThanOrEqual(minute);
    expect(await page.locator('#timer').getAttribute('stroke-dasharray')).not.toBe(progress);
    await page.locator('[data-close]').click();
    await page.locator('#menu').click();
    await page.getByRole('checkbox', { name: 'Recording', exact: true }).uncheck();
    const held = await page.evaluate(() => window.__murmur.state!.minute);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__murmur.state!.minute)).toBe(held);
    await page.locator('#bp-send').click();
    const before = (await requests()).length;
    await page.getByRole('button', { name: "I'm confused", exact: true }).click();
    expect(await requests()).toHaveLength(before);
    await page.locator('#feedback-note').fill('Local mocked control');
    expect(await page.locator('#feedback-send').innerText()).toBe('Submit');
    await page.locator('#feedback-send').click();
    await page.waitForFunction(() =>
      document.querySelector('#feedback-status')?.textContent?.includes('Your note is stored'),
    );
    const sent = (await requests()).slice(before);
    expect(sent.length).toBeGreaterThan(0);
    expect(JSON.stringify(sent)).toContain("I'm confused");
    expect(JSON.stringify(sent)).not.toContain('murmur-notebook/1');
    expect(await page.locator('#feedback-status').innerText()).toContain('Reference');
    await page.locator('#feedback-back').click();
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
}, 30000);

for (const compression of ['gzip', 'checkpoint'])
  it(`reloads the exact unanswered minute and fractional clock from ${compression}`, async () => {
    const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
    await server.listen();
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
      if (compression === 'checkpoint')
        await page.addInitScript(() => {
          Object.defineProperty(window, 'CompressionStream', {
            value: class {
              constructor() {
                throw new Error('controlled compression failure');
              }
            },
          });
        });
      await page.goto(`${server.resolvedUrls!.local[0]}`);
      await page.evaluate(async () => {
        await window.__murmur.ready;
        window.__murmur.start(17);
      });
      await page.locator('#hush').waitFor();
      await page.clock.runFor(14000);
      await page.locator('#menu').click();
      const remaining = await page.locator('#timer').getAttribute('stroke-dasharray');
      const before = await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide'));
        return JSON.parse(JSON.stringify(window.__murmur.state));
      });
      await page.reload();
      await page.locator('#cont').waitFor();
      // Freeze only this restoration measurement; normal moving-clock behavior is tested separately.
      await page.clock.pauseAt(new Date('2026-10-29T00:02:00Z'));
      expect(await page.locator('.title').innerText()).toContain('with her choice still waiting');
      await page.locator('#cont').click();
      await page.locator('#hush').waitFor();
      const after = await page.evaluate(() => JSON.parse(JSON.stringify(window.__murmur.state)));
      expect(after).toEqual(before);
      expect(after.card.closesAt).toBe(before.card.closesAt);
      expect(await page.locator('#timer').getAttribute('stroke-dasharray')).toBe(remaining);
      await page.close();
    } finally {
      await browser.close();
      await server.close();
    }
  }, 30000);
