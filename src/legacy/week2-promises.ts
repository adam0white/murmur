/** Edition0.6.1: dialling is not the whole promised call. A distraction tests whether she stays. */
import type { Moment } from './types.ts';
export const MUM_CALLS: Moment[] = [8, 9, 10, 11, 12].map((day) => ({
  id: `mum-attention-${day}`,
  day,
  at: (c) => (day === 12 && c.flags.w2?.earlyBus ? 17 * 60 + 29 : 18 * 60 + 14),
  place: 'phone',
  when: (c) => c.chosen[`bus-${day}`] === 'call',
  scene:
    'Mum answers. A video starts playing on the seat beside Dilan. Mum pauses halfway through a sentence. Dilan promised her twenty minutes, not just a hello.',
  pull: { to: 'scroll', line: 'Keep the line open. You can listen and watch at the same time.' },
  options: [
    {
      id: 'listen',
      ink: 'Put the screen away. Let Mum finish.',
      label: 'listen to Mum',
      action: 'listen-to-mum',
      duration: 17,
      effort: 0.2,
      focus: 0.5,
      advertises: { belonging: 0.15, esteem: -0.15 },
      gives: { belonging: 0.45, meaning: 0.2 },
      norms: [{ normId: 'kindness-to-parents', relation: 'fulfills' }],
      phrase: { id: 'ten', kind: 'redirect', text: 'It’s ten minutes' },
      done: 'She put the screen away. Mum finished the story. They talked until Dilan’s stop.',
    },
    {
      id: 'later',
      ink: 'Say you have to go. Leave the rest for tomorrow.',
      label: 'end the call early',
      action: 'end-call',
      duration: 2,
      advertises: { rest: 0.2 },
      gives: { rest: 0.1 },
      done: '“Tomorrow, then,” Mum said. Today’s promised call was still unfinished.',
    },
    {
      id: 'scroll',
      ink: 'Keep the line open and watch the video.',
      label: 'watch while Mum talks',
      action: 'scroll',
      duration: 17,
      advertises: { leisure: 0.3 },
      gives: { leisure: 0.05, meaning: -0.1 },
      tags: ['temptation'],
      norms: [{ normId: 'keep-promise', relation: 'violates' }],
      done: 'Mum asked if she was still there. Dilan asked her to start again, but the bus had reached her stop. The promised conversation was unfinished.',
    },
  ],
  after: (s, chosen) => {
    if (chosen === 'listen') s.flags.calls = (s.flags.calls ?? 0) + 1;
  },
}));
