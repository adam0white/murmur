/** Murmur's HF 4 boundary: world effects are staged until their receipts are accepted. */
import {
  type DeepReadonly,
  type HostRequest,
  type Input,
  type Run,
  type StepResult,
  step,
} from '@adam0white/human-framework';
import { companionOffersUntil } from './hf4-companions.ts';
import { invalidateReadings } from './hf4-read.ts';

export interface BoundarySettlement<H> {
  host: H;
  input: Input<'action.resolved' | 'communication.resolved'>;
}

/** A resolver reports actual outcomes and writes every host-state change in its worldChange. */
export type ResolveBoundary<H> = (host: H, request: DeepReadonly<HostRequest>) => BoundarySettlement<H>;

/** Return all reached events, including the decision before a world-required boundary.
 * The resolver owns action and communication semantics. HF owns the settled-request ledger.
 */
export function advanceHost<H>(
  bridge: { run: Run; host: H; nextCompanionEvent: number; companionRevisions: Record<string, number> },
  until: number,
  inputs: readonly Input[],
  resolve: ResolveBoundary<H>,
): {
  host: H;
  result: DeepReadonly<StepResult>;
  events: readonly DeepReadonly<StepResult['events'][number]>[];
} {
  const companion = companionOffersUntil(bridge.nextCompanionEvent, until, bridge.companionRevisions);
  let batch: readonly Input[] = [...inputs, ...companion.inputs];
  let first = true;
  let staged: { host: H } | undefined;
  const events: DeepReadonly<StepResult['events'][number]>[] = [];
  for (let count = 0; count < 10_000; count++) {
    invalidateReadings(bridge.run);
    const stepped = step(bridge.run, { until, inputs: batch });
    if (!stepped.ok) throw new Error(`${stepped.error.code} ${stepped.error.path}: ${stepped.error.message}`);
    if (first) {
      bridge.nextCompanionEvent = companion.nextEvent;
      bridge.companionRevisions = companion.revisions;
      first = false;
    }
    if (staged) {
      bridge.host = staged.host;
      staged = undefined;
    }
    const result = stepped.value;
    events.push(...result.events);
    if (result.boundary.type === 'until') {
      if (!result.reachedUntil || result.at !== until)
        throw new Error('Murmur did not reach its target time');
      return { host: bridge.host, result, events };
    }
    if (!result.boundary.requests.length) throw new Error('HF requested an empty world boundary');
    let next = structuredClone(bridge.host);
    const receipts: Input<'action.resolved' | 'communication.resolved'>[] = [];
    for (const request of [...result.boundary.requests].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      const settled = resolve(next, request);
      next = settled.host;
      receipts.push(settled.input);
    }
    staged = { host: next };
    batch = receipts;
  }
  throw new Error('Murmur exceeded its host boundary budget');
}
