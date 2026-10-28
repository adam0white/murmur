/** Authored names and calendar shared by the simulation and story. */
export const YOU = 'you';
export const PULL = 'pull';
/** Day 1 (Monday) starts at this absolute minute: day 400 of the sim calendar. */
export const DAY0 = 400 * 1440;
export const dayStart = (day: number) => DAY0 + (day - 1) * 1440;
export const WAKE = 6 * 60 + 40;
export const REVIEW_AT = 22 * 60;

/** Labels HF uses in its own sentences ("I didn't keep my call to Mum."). */
export const LABEL = {
  alarm: 'my alarm',
  mum: 'my call to Mum',
  aylin: 'my word to Aylin',
  bedtime: 'my bedtime',
} as const;

/** Describe actual review outcomes without turning semantic commitment labels into sentences. */
export function promiseReview(kept: string[], missed: string[], ruminating: boolean): string | undefined {
  const actions: Record<string, string> = {
    [LABEL.alarm]: 'get up when the alarm rang',
    [LABEL.mum]: 'make time to talk to Mum',
    [LABEL.aylin]: 'stay for dinner with Aylin',
    [LABEL.bedtime]: 'put the phone away before bed',
    'my board practice with Ece': 'practise routing deliveries with Ece',
    'my word to Ece': 'help Ece close the depot',
  };
  const labels = missed.length ? missed : kept;
  if (!labels.length || labels.some((label) => !actions[label])) return;
  if (missed.length) {
    return `${labels.map((label) => `I didn’t ${actions[label]}.`).join(' ')} ${ruminating ? 'I keep thinking about it.' : 'Next time I’ll be ready.'}`;
  }
  const completed: Record<string, string> = {
    [LABEL.alarm]: 'got up when the alarm rang',
    [LABEL.mum]: 'made time to talk to Mum',
    [LABEL.aylin]: 'stayed for dinner with Aylin',
    [LABEL.bedtime]: 'put the phone away before bed',
    'my board practice with Ece': 'practised routing deliveries with Ece',
    'my word to Ece': 'helped Ece close the depot',
  };
  return labels.map((label) => `Today I ${completed[label]}.`).join(' ');
}
