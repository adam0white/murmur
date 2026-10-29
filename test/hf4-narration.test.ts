import { exportRun } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { MURMUR_ACTIONS } from '../src/sim/hf4-actions.ts';
import { freshMurmurHf4 } from '../src/sim/hf4-game.ts';

it('supplies grammatical Murmur action forms and Dilan voice through the opening lexicon', () => {
  const saved = exportRun(freshMurmurHf4(17).run);
  const lexicon = saved.initial.spec.definitions.lexicon;
  expect(lexicon.actions['get-up']).toEqual({ base: 'get up', past: 'got up', gerund: 'getting up' });
  expect(lexicon.actions['call-mum']?.past).toBe('talked with Mum');
  expect(lexicon.voices?.dilan?.['suggestion.resolved']).toHaveLength(4);
  expect(lexicon.names.dilan).toBe('Dilan');
  expect(MURMUR_ACTIONS.filter((id) => !lexicon.actions[id])).toEqual([]);
});
