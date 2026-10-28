import type { Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { playedFirstWeek } from '../src/legacy/firstweek.ts';
import { anotherWeek, cloneState, queueInput, runToCard } from '../src/legacy/game.ts';
import { expandNotebook } from '../src/ui/notebook.ts';
import { chooseSeed, launchBrowser } from './browser.ts';

let browser: Browser;
let server: ViteDevServer;
let url: string;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  url = server.resolvedUrls?.local[0] ?? '';
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
for (const width of [360, 1280]) {
  it(`keeps answers pinned and reading inside the card at ${width}`, async () => {
    const height = width === 360 ? 690 : 800;
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(`${url}`);
      await page.evaluate(() => {
        window.__murmur.fast = true;
        window.__murmur.start(1);
      });
      await page.locator('#hush').waitFor();
      expect(await page.locator('.card-actions').count()).toBe(1);
      const before = await page.locator('#hush').boundingBox();
      await page.locator('.card-text').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await page.locator('#hush').boundingBox()).toEqual(before);
      expect((before?.y ?? 0) + (before?.height ?? 0)).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(height);
      if (width === 360) {
        const journal = await page.locator('#journal').boundingBox();
        expect(journal?.height).toBeGreaterThanOrEqual(64);
        expect(journal?.height).toBeLessThanOrEqual(112);
      } else {
        const journal = await page.locator('#journal').boundingBox();
        const card = await page.locator('.card').boundingBox();
        expect((journal?.x ?? 0) + (journal?.width ?? 0)).toBeLessThanOrEqual(card?.x ?? 0);
      }
    } finally {
      await page.close();
    }
  }, 30000);
}
it('releases feedback and reading holds when returning to the title page', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${url}`);
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(1);
    });
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    await page.locator('#menu').click();
    await page.locator('#bp-title').click();
    await page.locator('#cont').click();
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    expect(await page.locator('.feedback').count()).toBe(1);
  } finally {
    await page.close();
  }
}, 30000);
for (const mode of ['linked', 'off', 'privacy'] as const) {
  it(`sends feedback through the ${mode} consent path and remembers its name`, async () => {
    const page = await browser.newPage();
    try {
      await page.addInitScript((mode) => {
        localStorage.removeItem('hf-lab-recording-off');
        if (mode === 'off') localStorage.setItem('hf-lab-recording-off', '1');
        if (mode === 'privacy') Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
      }, mode);
      await page.goto(`${url}`);
      await page.evaluate(async () => {
        const path = '/src/ui/lab.ts';
        const { lab } = await new Function('path', 'return import(path)')(path);
        const calls: unknown[] = [];
        Object.assign(window, { feedbackCalls: calls });
        lab.sendFeedback = async (...args: unknown[]) => {
          calls.push(['feedback', ...args]);
          return 'stub';
        };
        lab.sendRun = async (...args: unknown[]) => {
          calls.push(['run', ...args]);
          return 'stub';
        };
        window.__murmur.fast = true;
        window.__murmur.start(1);
      });
      await page.locator('#menu').click();
      // The SDK deliberately disables recording on localhost. Model its on state for this form-only test.
      if (mode === 'linked')
        await page.evaluate(async () => {
          const { lab } = await new Function('return import("/src/ui/lab.ts")')();
          Object.defineProperty(lab, 'telemetryOn', { get: () => true });
        });
      await page.locator('#bp-send').click();
      const share = page.getByRole('checkbox', {
        name: 'Share this run and my play with the lab',
        exact: true,
      });
      expect(await share.count()).toBe(mode === 'linked' ? 0 : 1);
      if (mode !== 'linked') {
        expect(await share.isVisible()).toBe(true);
        expect(await share.isChecked()).toBe(false);
      }
      await page.locator('[data-verdict="keep"]').click();
      await page.locator('#feedback-note').fill('I wanted to read the reply.');
      await page.locator('.feedback-name summary').click();
      await page.locator('#feedback-name').fill('  tester  ');
      expect((await page.locator('#feedback-note').boundingBox())?.height).toBeGreaterThanOrEqual(100);
      if (mode === 'off') {
        expect(await page.locator('#feedback-send').isDisabled()).toBe(false);
      }
      if (mode === 'privacy') {
        expect(await page.locator('#feedback-send').isDisabled()).toBe(false);
      }
      await page.locator('#feedback-send').click();
      await page.waitForFunction(() =>
        document.querySelector('#feedback-status')?.textContent?.includes('Your note is stored'),
      );
      expect(await page.locator('#feedback-status').innerText()).toBe(
        'Sent. Your note is stored. Reference stub.',
      );
      const calls = await page.evaluate(() => Reflect.get(window, 'feedbackCalls'));
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('feedback');
      const extra = calls[0].at(-1);
      expect(extra.name).toBe('tester');
      if (mode === 'linked')
        expect((await expandNotebook(extra.run)).state).toEqual(
          await page.evaluate(async () => {
            const { cloneState } = await new Function('return import("/src/sim/game.ts")')();
            return cloneState(window.__murmur.state!);
          }),
        );
      else expect(extra.run).toBeUndefined();
      expect(calls[0][1]).toContain('Verdict: keep');
      expect(await page.evaluate(() => localStorage.getItem('hf-lab-feedback-name'))).toBe('tester');
      await page.locator('#feedback-send').click();
      await page.locator('#bp-send').click();
      expect(await page.locator('#feedback-name').inputValue()).toBe('tester');
    } finally {
      await page.close();
    }
  }, 30000);
}
it('offers privacy beside the recording switch and yields journal room before scrolling long text', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    // Build the actual long journal headlessly, then render its ordinary saved notebook.
    // Re-rendering and saving every earlier card is unrelated to this layout assertion.
    const state = anotherWeek(playedFirstWeek(1));
    while (state.card?.moment !== 'bus-10') {
      if (state.phase === 'evening') queueInput(state, { kind: 'next' });
      else {
        runToCard(state);
        if (state.card && state.card.moment !== 'bus-10') queueInput(state, { kind: 'quiet' });
      }
    }
    await page.addInitScript((saved) => {
      localStorage.setItem(
        'murmur-save-v1',
        JSON.stringify({
          format: 'murmur-save/2',
          version: saved.version,
          seed: saved.seed,
          inputs: saved.inputs,
          state: saved,
        }),
      );
    }, cloneState(state));
    await page.goto(`${url}`);
    await chooseSeed(page, 1);
    await page.locator('#menu').click();
    expect(await page.locator('.menu-footer').getByRole('link', { name: 'Lab privacy' }).count()).toBe(1);
    await page.locator('#bp-close').click();
    await page.evaluate(() => (window.__murmur.fast = true));
    await page.locator('#cont').click();
    await page.waitForFunction(() => window.__murmur.view()?.id === 'bus-10');
    expect(await page.evaluate(() => window.__murmur.view()?.id)).toBe('bus-10');
    expect((await page.locator('#journal').boundingBox())!.height).toBeLessThan(112);
  } finally {
    await page.close();
  }
}, 30000);
it('refreshes Send when the shared recording preference changes after the form opens', async () => {
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('hf-lab-recording-off', '1'));
    await page.goto(`${url}`);
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    expect(await page.locator('#feedback-send').isDisabled()).toBe(false);
    await page.evaluate(async () => {
      const { lab } = await new Function('return import("/src/ui/lab.ts")')();
      lab.setEventsOff(false);
    });
    expect(await page.locator('#feedback-send').isDisabled()).toBe(false);
  } finally {
    await page.close();
  }
}, 30000);
it('records a refusal once in plain words, including on a legacy run', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${url}`);
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(9, '0.2.1');
    });
    await page.locator('#hush').waitFor();
    await page.evaluate(() => window.__murmur.say('up'));
    const journal = await page.locator('#journal').innerText();
    expect(journal).toContain(
      'You suggested “Get up and put your feet on the floor.” She chose “Sleep for five more minutes.”',
    );
    expect(journal).not.toMatch(/pencil’s way|She didn’t\. She|She put yours off/);
  } finally {
    await page.close();
  }
}, 30000);

it('quotes an already quoted suggestion only once in the journal', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${url}`);
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(1);
      window.__murmur.skipToCard();
      for (let i = 0; i < 20 && window.__murmur.view()?.id !== 'lunch-1'; i++) window.__murmur.quiet();
      window.__murmur.say('defend');
    });
    const journal = await page.locator('#journal .record-yours').allTextContents();
    expect(journal.join(' ')).toContain('“She found it, didn’t she?”');
    expect(journal.join(' ')).not.toContain('““');
  } finally {
    await page.close();
  }
}, 30000);

it('keeps an explicitly started run when the asynchronous bootstrap finishes later', async () => {
  const page = await browser.newPage({
    viewport: { width: 360, height: 690 },
    serviceWorkers: 'block',
    extraHTTPHeaders: { DNT: '1' },
  });
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://murmur.adamwhite.work/**', async (route) => {
    const requested = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: new URL(requested.pathname + requested.search, url).href }),
    });
  });
  await page.route('**/lab/api/**', (route) => route.abort());
  const identity = 'https://human.adamwhite.work/lab/identity/**';
  await page.route(identity, async (route) => {
    await held;
    await route.abort();
  });
  try {
    const requested = page.waitForRequest(identity);
    await page.goto('https://murmur.adamwhite.work/', { waitUntil: 'domcontentloaded' });
    await requested;
    await page.waitForFunction(() => Boolean(window.__murmur));
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(31);
    });
    release();
    await page.evaluate(() => window.__murmur.ready);
    expect(await page.locator('#dayroot').count()).toBe(1);
    expect(await page.locator('#new').count()).toBe(0);
    expect(await page.evaluate(() => window.__murmur.state?.seed)).toBe(31);
  } finally {
    release();
    await page.close();
  }
}, 30000);

it('opts into sharing through one unchecked checkbox and sends the note', async () => {
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('hf-lab-recording-off', '1'));
    await page.goto(`${url}`);
    await page.evaluate(async () => {
      const { lab } = await new Function('return import("/src/ui/lab.ts")')();
      lab.setPersonaRecording('legacy-title-fixture');
      const calls: unknown[] = [];
      Object.assign(window, { scopedFeedbackCalls: calls });
      lab.sendFeedback = async (...args: unknown[]) => {
        calls.push(args);
        return 'scoped-note';
      };
    });
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    const share = page.getByRole('checkbox', {
      name: 'Share this run and my play with the lab',
      exact: true,
    });
    expect(await share.count()).toBe(1);
    expect(await share.isVisible()).toBe(true);
    expect(await share.isChecked()).toBe(false);
    await share.check();
    expect(await page.locator('#feedback-send').isEnabled()).toBe(true);
    await page.locator('#feedback-note').fill('Share my play with this note.');
    await page.locator('#feedback-send').click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'scopedFeedbackCalls').length)).toBe(1);
    const calls = await page.evaluate(() => Reflect.get(window, 'scopedFeedbackCalls'));
    expect(calls[0][1].sharePlay).toBe(true);
  } finally {
    await page.close();
  }
}, 30000);

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
]) {
  it(`keeps the whole title and expanded Debug readable at ${viewport.width}`, async () => {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(url);
      await page.locator('#new').waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Check actual painted text, not merely its presence in the DOM.
      for (const paragraph of await page.locator('.title .page-body > p').all()) {
        await paragraph.scrollIntoViewIfNeeded();
        expect(
          await paragraph.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return [...range.getClientRects()].every((rect) => {
              const x = rect.x + rect.width / 2,
                y = rect.y + rect.height / 2;
              return y >= 0 && y < innerHeight && el.contains(document.elementFromPoint(x, y));
            });
          }),
        ).toBe(true);
      }
      await page.locator('#other-ways').scrollIntoViewIfNeeded();
      const cast = await page.locator('.title .page-body > p').last().boundingBox();
      const other = await page.locator('#other-ways').boundingBox();
      expect(other!.y).toBeGreaterThanOrEqual(cast!.y + cast!.height);
      await page.locator('#new').click();
      await page.locator('#menu').click();
      const resumeBefore = await page.locator('#bp-close').evaluate((el) => (el as HTMLElement).offsetTop);
      await page.getByText('Debug', { exact: true }).click();
      expect(await page.locator('#bp-close').evaluate((el) => (el as HTMLElement).offsetTop)).toBeGreaterThan(
        resumeBefore,
      );
      const download = page.waitForEvent('download');
      await page.locator('#bp-export').click();
      expect((await download).suggestedFilename()).toMatch(/^two-voices-.*\.json$/);
    } finally {
      await page.close();
    }
  }, 30000);
}
