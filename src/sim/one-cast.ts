import { departureReleaseDescription as historicalDescription } from '../legacy/one-cast.ts';

export type { DepartureReceipt } from '../legacy/one-cast.ts';

import { readDilan } from './hf4-read.ts';
import type { GameState } from './types.ts';
export const departureReleaseDescription = (s: GameState) =>
  !('hf' in s)
    ? historicalDescription(s as unknown as import('../legacy/types.ts').GameState)
    : readDilan(s.hf.run)
        .agenda.goals.filter((g) => g.status === 'active')
        .map((g) => g.label);
export function releaseOneCastDeparture(_s: GameState): never {
  throw new Error(
    'Use the current cast checkpoint. Keep old source notebooks; start a separate fresh story.',
  );
}
