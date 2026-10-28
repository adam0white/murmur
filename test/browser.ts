/** Controlled repository WebKit QA only. No isolated Chrome profile or live transport receipt. */
import { type BrowserContextOptions, type Page, webkit } from 'playwright';
export async function launchBrowser() {
  const browser = await webkit.launch();
  const context = browser.newContext.bind(browser);
  browser.newContext = async (options?: BrowserContextOptions) => {
    const c = await context(options);
    await c.route('https://human.adamwhite.work/**', (route) => route.abort());
    return c;
  };
  browser.newPage = async (options?: BrowserContextOptions) => {
    const c = await browser.newContext(options);
    const p = await c.newPage();
    const close = p.close.bind(p);
    p.close = async (options) => {
      await close(options);
      if (browser.isConnected()) await c.close();
    };
    return p;
  };
  return browser;
}

/** Select the next authored seed through the public diagnostics, without URL switches. */
export async function chooseSeed(page: Page, seed: number) {
  await page.locator('#menu').click();
  await page.getByText('Debug', { exact: true }).click();
  await page.locator('#debug-seed').fill(String(seed));
  await page.locator('#bp-close').click();
}
