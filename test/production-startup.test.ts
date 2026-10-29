import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { type PreviewServer, preview } from 'vite';
import { expect, it } from 'vitest';

it('renders the production bundle and recording controls at both sizes', async () => {
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  let server: PreviewServer | undefined;
  const browser = await chromium.launch();
  try {
    server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
    const origin = server.resolvedUrls?.local[0];
    if (!origin) throw new Error('Preview did not provide a local URL.');
    for (const viewport of [
      { width: 360, height: 690 },
      { width: 1280, height: 800 },
    ]) {
      const context = await browser.newContext({ viewport, extraHTTPHeaders: { DNT: '1' } });
      await context.route('https://human.adamwhite.work/**', (route) => route.abort());
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin);
      await expect(page.locator('body').innerText()).resolves.toContain('Two Voices');
      await expect(page.locator('body').innerText()).resolves.toContain('We record and link play');
      await page.locator('#menu').click();
      await expect(page.locator('body').innerText()).resolves.toContain('Recording');
      await page.locator('#bp-close').click();
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.locator('#hush').waitFor({ timeout: 30_000 });
      expect(errors).toEqual([]);
      await context.close();
    }
  } finally {
    await browser.close();
    const httpServer = server?.httpServer;
    if (httpServer)
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      );
  }
}, 60_000);
