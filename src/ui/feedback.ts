import { feedbackPersonaControl, telemetryToggle } from '@adam0white/lab-kit';
import type { lab as gameLab } from './lab.ts';

const NAME_KEY = 'hf-lab-feedback-name';
const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
const recordingOff = () => {
  try {
    return localStorage.getItem('hf-lab-recording-off') === '1';
  } catch {
    return false;
  }
};

export function showFeedback(options: {
  app: HTMLElement;
  lab: typeof gameLab;
  getRun: () => unknown;
  download: () => void;
  close: () => void;
}) {
  const { app, lab } = options;
  const previous = document.activeElement as HTMLElement | null;
  const background = [...app.children] as HTMLElement[];
  const oldInert = background.map((node) => node.inert);
  const dayChildren = background.flatMap((node) =>
    node.matches('.day') ? ([...node.children] as HTMLElement[]) : [],
  );
  const childInert = dayChildren.map((node) => node.inert);
  for (const node of background) {
    if (!node.matches('.top')) node.inert = true;
    if (node.matches('.day')) {
      node.inert = false;
      for (const child of node.children) if (!child.matches('.top')) (child as HTMLElement).inert = true;
    }
  }
  let remembered = '';
  try {
    remembered = localStorage.getItem(NAME_KEY) ?? '';
  } catch {}
  const wrap = document.createElement('div');
  wrap.className = 'feedback-wrap';
  wrap.innerHTML = `<section class="feedback" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
    <div class="feedback-heading"><button id="feedback-back">← Back</button><h2 id="feedback-title">Send word</h2></div>
    <div class="feedback-body">
      <p>Send a note about this game. Recording and continuing-person choices are optional.</p>
      <div class="verdicts" role="group" aria-label="Would you keep playing?">
        <button type="button" class="chip" data-verdict="keep" aria-pressed="false">I'd keep playing</button>
        <button type="button" class="chip" data-verdict="mixed" aria-pressed="false">Not sure</button>
        <button type="button" class="chip" data-verdict="quit" aria-pressed="false">I'd stop here</button>
      </div>
      <label for="feedback-note">What happened in Dilan's week, what you wanted, what got in the way.</label>
      <textarea id="feedback-note" rows="4" placeholder="What happened in Dilan's week, what you wanted, what got in the way."></textarea>
      <details class="feedback-name"><summary>+ Your name or tester id</summary>
        <label for="feedback-name">Your name or tester id</label><input type="text" id="feedback-name" maxlength="60" autocomplete="off" value="${esc(remembered)}" />
        <p class="soft small">A name labels everything this device has sent, past and future. Leave it empty to stay unnamed.</p>
      </details>
      <details class="feedback-preview"><summary>What is sent</summary><p>Your note, optional verdict and name. With recording off, no run or linked history is sent.</p><pre id="feedback-preview"></pre><a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">Lab privacy</a></details>
      <div class="feedback-recording" id="feedback-recording"><p>Recording is off. You can still send your note.</p><div id="feedback-toggle"></div></div>
      <label class="feedback-consent" id="feedback-consent"><input type="checkbox" id="feedback-consent-check" /> Send this run with my note</label>
      <button type="button" id="feedback-download">Keep a copy of this run</button>
      <p role="status" id="feedback-status"></p>
    </div>
    <div class="feedback-actions page-actions"><button class="primary" id="feedback-send">Send</button></div>
  </section>`;
  app.append(wrap);
  wrap.querySelector('#feedback-toggle')?.append(telemetryToggle(lab));
  const note = wrap.querySelector<HTMLTextAreaElement>('#feedback-note')!;
  const name = wrap.querySelector<HTMLInputElement>('#feedback-name')!;
  const consent = wrap.querySelector<HTMLInputElement>('#feedback-consent-check')!;
  const send = wrap.querySelector<HTMLButtonElement>('#feedback-send')!;
  const status = wrap.querySelector<HTMLElement>('#feedback-status')!;
  const feedbackRun = () => {
    try {
      return options.getRun();
    } catch {
      return undefined;
    }
  };
  const personaChoice = feedbackPersonaControl(lab);
  if (personaChoice) wrap.querySelector('textarea')?.after(personaChoice);

  let verdict = '';
  let sent = false;
  let sending = false;
  const close = () => {
    if (!wrap.isConnected) return;
    window.removeEventListener('hf-lab-preference', syncPreference);
    wrap.remove();
    background.forEach((node, index) => {
      node.inert = oldInert[index] ?? false;
    });
    dayChildren.forEach((node, index) => {
      node.inert = childInert[index] ?? false;
    });
    previous?.focus();
    options.close();
  };
  const refresh = () => {
    const off = recordingOff();
    const privacy = lab.privacySignalOn && !lab.privacyOverride;
    wrap.querySelector<HTMLElement>('#feedback-recording')!.hidden = !off;
    wrap.querySelector<HTMLElement>('#feedback-consent')!.hidden = off || !privacy;
    send.disabled = !sent && sending;
    const preview = {
      note: note.value,
      verdict: verdict || undefined,
      name: name.value.trim() || undefined,
      run: feedbackRun(),
    };
    wrap.querySelector('#feedback-preview')!.textContent = JSON.stringify(preview, null, 2);
  };
  const syncPreference = () => {
    wrap.querySelector<HTMLInputElement>('#feedback-toggle input')!.checked = lab.eventsOn;
    refresh();
  };
  wrap.addEventListener('input', refresh);
  wrap.addEventListener('change', refresh);
  wrap.querySelector('#feedback-back')?.addEventListener('click', close);
  wrap.querySelector('#feedback-download')?.addEventListener('click', options.download);
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key !== 'Tab') return;
    const controls = [
      ...wrap.querySelectorAll<HTMLElement>('button:not(:disabled), a, input, textarea, summary'),
    ].filter((node) => node.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  for (const button of wrap.querySelectorAll<HTMLButtonElement>('[data-verdict]'))
    button.addEventListener('click', () => {
      verdict = verdict === button.dataset.verdict ? '' : (button.dataset.verdict ?? '');
      for (const item of wrap.querySelectorAll<HTMLButtonElement>('[data-verdict]'))
        item.setAttribute('aria-pressed', String(item.dataset.verdict === verdict));
      refresh();
    });
  send.addEventListener('click', async () => {
    if (sent) {
      close();
      return;
    }
    if (send.disabled) return;
    sending = true;
    refresh();
    const submittedName = name.value.trim().slice(0, 60);
    const submittedNote = [verdict ? `Verdict: ${verdict}` : '', note.value.trim()]
      .filter(Boolean)
      .join('\n\n');
    const privacy = lab.privacySignalOn && !lab.privacyOverride;
    try {
      if (!recordingOff() && privacy && consent.checked && lab.personaRecordingAllowed) {
        await lab.sendRun(options.getRun(), { note: submittedNote, name: submittedName });
      } else await lab.sendFeedback(submittedNote, { name: submittedName, run: feedbackRun() });
      try {
        if (submittedName) localStorage.setItem(NAME_KEY, submittedName);
        else localStorage.removeItem(NAME_KEY);
      } catch {}
      sent = true;
      status.textContent = 'Sent. Thank you.';
      send.textContent = 'Back to the game';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not send. Try again.';
    } finally {
      sending = false;
      refresh();
    }
  });
  window.addEventListener('hf-lab-preference', syncPreference);
  refresh();
  wrap.querySelector<HTMLElement>('#feedback-back')?.focus();
}
