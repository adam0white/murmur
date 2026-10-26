/** Edition 0.3.0 presentation and authored configuration over HF's own will and advice. */
import {
  type Affordance,
  type Person,
  predict,
  rememberAdvice,
  rememberedTerms,
  type Suggestion,
  type SuggestionResolution,
} from '@adam0white/human-framework';
import type { GameState, Opt } from './types.ts';

const LISTENING_EDITION = '0.3.0';
/** Editions with gentle suggestions and retained HF advice. */
export const listens = (s: GameState | { version: string }) =>
  s.version === '0.8.0' ||
  s.version === '0.7.0' ||
  s.version === '0.6.0' ||
  s.version === '0.5.0' ||
  s.version === LISTENING_EDITION ||
  s.version === '0.4.0' ||
  s.version === '0.4.1' ||
  s.version === '0.4.2';
/** Utility units. HF draws against its own scores, after all hard vetoes. */
export const LISTENING_TEMPERATURE = 0.14;
export function configureListening(p: Person) {
  // Less settled habits make the first ordinary moments close calls, rather than staged wins.
  const bed = p.habits.find((h) => h.action === 'snooze');
  const phone = p.habits.find((h) => h.action === 'scroll');
  if (bed) bed.strength -= 0.12;
  if (phone) phone.strength -= 0.1;
}

/** Forecast at the same temperature resolve will use; predict never consumes the person's RNG. */
export function listeningForecast(
  p: Person,
  offers: Affordance[],
  suggestion: Suggestion,
  others: Suggestion[],
): SuggestionResolution {
  const temperature = p.will.temperature;
  p.will.temperature = suggestion.insist ? 0 : LISTENING_TEMPERATURE;
  try {
    return predict(p, offers, suggestion, { others });
  } finally {
    p.will.temperature = temperature;
  }
}
export function landingChance(r: SuggestionResolution): number {
  // HF may refuse credit to a distrusted voice while taking the option anyway.
  // Its likelihood describes the option landing, including that case.
  return r.likelihood ?? (r.verdict === 'assented' || r.verdict === 'complied' ? 1 : 0);
}
export function moodOf(r: SuggestionResolution): string {
  const chance = landingChance(r);
  if (chance === 0) return r.kind === 'cannot' ? 'She cannot do it.' : 'She will not do it.';
  if (chance === 1) return 'She is willing.';
  if (chance >= 0.5) return 'She leans toward it, but has not decided.';
  if (chance >= 0.1) return 'She is against it, but she is listening.';
  return 'She is firmly against it. There is a small chance she will listen.';
}

/** Narrative provenance only. HF owns remembered strength, decay, scoring and discharge. */
export function keepSuggestion(s: GameState, o: Opt, ink: string): string {
  rememberAdvice(s.person, {
    at: s.minute,
    channel: 'told',
    kind: 'gentle-suggestion',
    actorId: 'you',
    summary: ink,
    salience: 0.8,
    advice: [{ action: o.action, strength: 0.6 }],
  });
  s.thoughts ??= [];
  s.thoughts.push({
    moment: s.card?.moment ?? '',
    at: s.minute,
    action: o.action,
    ink,
    label: o.label,
  });
  if (o.action === 'call-mum') return 'You said call Mum. I’m not doing it now, but I’ll think about it.';
  if (o.action === 'get-up') return 'I’m not ready to get up yet. I heard you, though.';
  if (o.action === 'reply') return 'I could answer Aylin. Not now, but I’m thinking about what I’d say.';
  return 'I didn’t follow your suggestion. But I’m still thinking about it.';
}
export function recalledThought(s: GameState, offers: Affordance[]): string | undefined {
  if (!listens(s)) return;
  const thought = s.thoughts?.findLast(
    (t) =>
      t.moment !== s.card?.moment &&
      (s.person.will.advice ?? []).some(
        (a) => a.sourceId === 'you' && a.action === t.action && a.at === t.at,
      ) &&
      offers.some(
        (a) =>
          a.action === t.action &&
          rememberedTerms(s.person, a, s.person.now).some(
            (term) => term.source === 'suggestion:remembered:you' && term.value > 0,
          ),
      ),
  );
  if (!thought) return;
  if (thought.action === 'call-mum')
    return 'You told me to call Mum. I didn’t, but I thought about it. Maybe I will this time.';
  return `You said, “${thought.ink}” I didn’t follow your suggestion then, but I thought about it.`;
}
