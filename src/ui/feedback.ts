import { feedbackPersonaControl, feedbackSharePlay } from '@adam0white/lab-kit';
import type { lab as gameLab } from './lab.ts';

const NAME_KEY = 'hf-lab-feedback-name';
const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
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
    <div class="feedback-heading"><button id="feedback-back">← Back</button><h2 id="feedback-title">Feedback</h2></div>
    <div class="feedback-body">
      <p>Send a note about this game. When recording is on, your play history is linked across games on this device. You can switch recording off in the menu.</p>
      <div class="verdicts" role="group" aria-label="Would you keep playing?">
        <button type="button" class="chip" data-verdict="keep" aria-pressed="false">I'd keep playing</button>
        <button type="button" class="chip" data-verdict="mixed" aria-pressed="false">Not sure</button>
        <button type="button" class="chip" data-verdict="quit" aria-pressed="false">I'd stop here</button>
      </div>
      <label for="feedback-note">What happened? What did you want to do?</label>
      <textarea id="feedback-note" rows="4" placeholder="What happened? What did you want to do?"></textarea>
      <details class="feedback-name"><summary>+ Your name or tester ID</summary>
        <label for="feedback-name">Your name or tester ID</label><input type="text" id="feedback-name" maxlength="60" autocomplete="off" value="${esc(remembered)}" />
        <p class="soft small">This name labels past and future feedback and play history sent from this device. Leave it empty to stay unnamed.</p>
      </details>
      <details class="feedback-preview"><summary>What is sent</summary><p>We send your note and any verdict or name you enter. With recording off, we send no saved game or linked play history.</p>${new URLSearchParams(location.search).get('lab') === '1' ? '<pre id="feedback-preview"></pre>' : ''}<a href="https://human.adamwhite.work/lab/privacy/" target="_blank" rel="noreferrer">Lab privacy</a></details>
      ${new URLSearchParams(location.search).get('lab') === '1' ? '<button type="button" id="feedback-download">Download this run</button>' : ''}
      <p role="status" id="feedback-status"></p>
    </div>
    <div class="feedback-actions page-actions"><button class="primary" id="feedback-send">Submit</button></div>
  </section>`;
  app.append(wrap);
  const note = wrap.querySelector<HTMLTextAreaElement>('#feedback-note')!;
  const name = wrap.querySelector<HTMLInputElement>('#feedback-name')!;
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
    send.disabled = !sent && sending;
    const preview = {
      note: note.value,
      verdict: verdict || undefined,
      name: name.value.trim() || undefined,
      run: feedbackRun(),
    };
    const previewNode = wrap.querySelector('#feedback-preview');
    if (previewNode) previewNode.textContent = JSON.stringify(preview, null, 2);
  };
  const syncPreference = refresh;
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
    try {
      const sharePlay = feedbackSharePlay(personaChoice);
      const noteOnly = !lab.telemetryOn && !sharePlay;
      const receipt = await lab.sendFeedback(submittedNote, {
        name: submittedName,
        run: feedbackRun(),
        sharePlay,
      });
      const sentMessage = `${noteOnly ? 'Your note and verdict are queued. No saved game or linked play history was included.' : 'Your note and verdict are queued with any available saved game and linked play history.'} Receipt: ${receipt}`;
      try {
        if (submittedName) localStorage.setItem(NAME_KEY, submittedName);
        else localStorage.removeItem(NAME_KEY);
      } catch {}
      sent = true;
      status.textContent = sentMessage;
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
