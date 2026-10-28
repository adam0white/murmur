/** Each other person chooses against keeping their own time, in the same HF run. */
import type { Input } from '@adam0white/human-framework';
import type { CastRole } from './canonical-cast.ts';
import { companionOffersUntil } from './hf4-companions.ts';
import { advanceHost } from './hf4-host.ts';
import { offerForChoice } from './hf4-offers.ts';
import { readDilan } from './hf4-read.ts';
import { prepareChoice, settleMurmur } from './hf4-world.ts';
import type { GameState } from './types.ts';
export function playEncounter(
  s: GameState,
  person: Exclude<CastRole, 'dilan'>,
  action: string,
  duration: number,
  place: string,
): boolean {
  if (s.hf.host.active.some((a) => a.person === person)) return false;
  const now = readDilan(s.hf.run).at;
  if (companionOffersUntil(s.hf.nextCompanionEvent, now + 2, s.hf.companionRevisions).inputs.length) {
    advanceHost(s.hf, now + 2, [], (host, request) => settleMurmur(host, request, []));
    if (s.hf.host.active.some((a) => a.person === person)) return false;
  }
  const at = readDilan(s.hf.run).at + 1;
  const revision = (s.hf.companionRevisions[person] ?? 0) + 1;
  const id = `encounter:${person}:${s.day}:${s.inputs.length}:${action}`;
  const offers = [
    offerForChoice(
      person,
      {
        id: `${id}:join`,
        action,
        label: action,
        ink: '',
        done: '',
        duration,
        effort: 0.12,
        advertises: { meaning: 0.4, belonging: 0.35, autonomy: 0.2 },
      },
      place,
      [],
    ),
    offerForChoice(
      person,
      {
        id: `${id}:own`,
        action: 'own-time',
        label: 'keep own work and rest',
        ink: '',
        done: '',
        duration,
        effort: 0.05,
        advertises: { rest: 0.35, competence: 0.3, autonomy: 0.3 },
      },
      'home',
      [],
    ),
  ];
  const choices = offers.map((o) =>
    prepareChoice(o, o.id.endsWith(':join') ? { belonging: 0.2 } : { rest: 0.2 }),
  );
  const inputs: Input[] = [
    {
      id: `${id}:offers`,
      at,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person, revision, offers },
    },
    {
      id: `${id}:decision`,
      at,
      source: { type: 'host', id: 'murmur' },
      kind: 'decision.requested',
      payload: { person, reason: id, treatment: 'ordinary', offerRevision: revision },
    },
    {
      id: `${id}:close`,
      at: at + 1,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person, revision: revision + 1, offers: [] },
    },
  ];
  // No routine snapshot is allowed to overwrite the revision reserved for this decision.
  s.hf.companionRevisions[person] = revision + 1;
  const settle: Parameters<typeof advanceHost<typeof s.hf.host>>[3] = (host, request) =>
    settleMurmur(host, request, choices);
  advanceHost(s.hf, at + 1, inputs, settle);
  const activity = s.hf.host.active.find(
    (a) => a.person === person && offers.some((o) => o.id === a.offerId),
  );
  if (!activity) return false;
  const finished = advanceHost(s.hf, activity.start + duration * 60_000, [], settle);
  const completed = finished.events.some(
    (e) =>
      e.data.kind === 'action-settled' &&
      e.data.activityId === activity.activityId &&
      e.data.disposition === 'completed',
  );
  if (completed)
    s.cast?.encounters.push({ person, at: readDilan(s.hf.run).at / 60_000, action: activity.actionId });
  return completed && activity.offerId === offers[0]!.id;
}
