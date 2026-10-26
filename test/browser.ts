/** Controlled repository WebKit QA only. No isolated Chrome profile or live transport receipt. */
import { type BrowserContextOptions, webkit } from 'playwright';
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
