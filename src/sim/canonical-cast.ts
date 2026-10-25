/** Four maintained people. Private clues require a completed chosen encounter, never a passport. */
import {
  begin,
  createPerson,
  decide,
  finish,
  MINUTES_PER_YEAR,
  type Person,
  seedTie,
  snapshot,
  tick,
} from '@adam0white/human-framework';
import { castForGame } from '@adam0white/lab-client';
import { DAY0, makeDilan, WAKE } from './dilan.ts';
import type { GameState, Moment, Opt } from './types.ts';

export const CAST_VERSION = '0.6.0';
export const CAST = castForGame('murmur');
export type CastRole = 'dilan' | 'aylin' | 'ece' | 'murat';
export const roleOf = (castId: string): CastRole => {
  const role = CAST.find((c) => c.castId === castId)?.castId.split('.')[2];
  if (!role || !['dilan', 'aylin', 'ece', 'murat'].includes(role)) throw Error('Not a Murmur cast identity.');
  return role as CastRole;
};
export interface CastState {
  pauses?: Partial<
    Record<CastRole, { at: number; purposes: { id: string; label: string; progress: number }[] }>
  >;
  people: Record<CastRole, Person>;
  discoveries: { person: CastRole; at: number; line: string }[];
  encounters: { person: CastRole; at: number; action: string }[];
  assignments: Partial<Record<CastRole, string>>;
  contacts: Partial<Record<CastRole, string[]>>;
  places: Partial<Record<CastRole, string>>;
  extraWork: Partial<Record<CastRole, boolean>>;
}
export function freshCast(seed: number, plainEnglish = true): CastState {
  const people = {} as CastState['people'];
  for (const c of CAST) {
    const role = roleOf(c.castId);
    const now = DAY0 + WAKE - 1;
    const p =
      role === 'dilan'
        ? makeDilan(seed, plainEnglish)
        : createPerson({
            lexicon: { plainEnglish },
            id: role,
            name: c.name,
            seed: seed ^ (c.age * 7919),
            now,
            bornAt: now - c.age * MINUTES_PER_YEAR,
            sex: role === 'murat' ? 'male' : 'female',
            traits: { ...c.traits },
            values: { ...c.values },
          });
    p.traits = { ...c.traits };
    p.values = { ...c.values };
    if (role === 'dilan' || role === 'aylin') {
      seedTie(p, { otherId: role === 'dilan' ? 'aylin' : 'dilan', roles: ['sibling'] });
      seedTie(p, { otherId: 'mum', roles: ['parent'] });
    }
    if (role === 'dilan') seedTie(p, { otherId: 'ece', roles: ['colleague'] });
    if (role === 'ece') seedTie(p, { otherId: 'dilan', roles: ['colleague'] });
    people[role] = p;
  }
  return {
    people,
    discoveries: [],
    encounters: [],
    assignments: Object.fromEntries(CAST.map((c) => [roleOf(c.castId), c.assignments[0] ?? c.work])),
    contacts: {},
    places: {},
    extraWork: {},
  };
}
const clues: Record<
  CastRole,
  { moment: string; ink: string; action: string; duration: number; line: string }
> = {
  dilan: {
    moment: 'shelf-4',
    ink: 'Name the crooked support. Ask Aylin for a short practical visit.',
    action: 'call-aylin',
    duration: 20,
    line: 'Dilan moved the boxes. One unevenly drilled support had been hidden behind them. “That one,” she told Aylin. “Can you look with me?” They agreed to inspect it together; the shelf was still unfinished.',
  },
  aylin: {
    moment: 'dinner-3',
    ink: 'Stay for dinner. Ask what Aylin wants to do on her own evening.',
    action: 'dinner',
    duration: 90,
    line: 'After dinner Aylin mentioned a dance class above a tyre shop. “I like being bad at something there.” Dilan left the joke unsaid. Aylin had shared something private. She had not invited the whole family.',
  },
  ece: {
    moment: 'lunch-2',
    ink: 'Ask Ece where she takes a break away from the depot.',
    action: 'chat',
    duration: 20,
    line: 'Ece unfolded a map of places to sit without buying anything. It listed shade, seats with backs, and closing times. She was checking it between courier shifts and logistics classes. “It isn’t an accessibility survey,” she said. Dilan asked before keeping a copy.',
  },
  murat: {
    moment: 'route-3',
    ink: 'Decline the extra route. Ask Murat to open the allocation record with you.',
    action: 'review-route',
    duration: 20,
    line: 'Murat opened the scheduling file. After Dilan questioned a target, he had given her the difficult delivery stops. He had then recorded the delays as her fault. He admitted that he had assigned the stops. The workers still needed a corrected record; one private admission had not corrected it.',
  },
};
export function castOptions(s: GameState, m: Moment, base: Opt[]): Opt[] {
  if (!s.cast) return base;
  const found = Object.entries(clues).find(([, c]) => c.moment === m.id);
  if (!found) return base;
  const [role, c] = found as [CastRole, (typeof clues)[CastRole]];
  return [
    ...base,
    {
      id: `reveal-${role}`,
      ink: c.ink,
      label: c.ink,
      action: c.action,
      duration: c.duration,
      advertises: { belonging: 0.25, meaning: 0.2 },
      gives: { belonging: 0.25, meaning: 0.2 },
      placeId: m.place,
      done: c.line,
    },
  ];
}
/** Ordinary offscreen meals, work and sleep, through the same HF action protocol. No passport or life catch-up calls this. */
function companionRoutine(p: Person, until: number, cast: CastState, role: CastRole): void {
  while (p.now < until && p.body.alive) {
    const hour = (p.now % 1440) / 60;
    const action =
      hour < 7 || hour >= 22
        ? 'sleep'
        : (hour >= 7 && hour < 8) || (hour >= 12 && hour < 13) || (hour >= 18 && hour < 19)
          ? 'meal'
          : hour >= 8 && hour < 17
            ? 'work'
            : 'rest';
    const duration = Math.min(until - p.now, 30);
    const needs =
      action === 'meal'
        ? { food: 0.6, water: 0.7 }
        : action === 'work'
          ? { competence: 0.05, water: 0.25 }
          : { water: 0.15, autonomy: 0.1 };
    const aff = {
      id: `routine-${p.now}`,
      label: action === 'work' ? (cast.assignments[role] ?? action) : action,
      placeId:
        action === 'work'
          ? role === 'aylin'
            ? 'kitchen'
            : cast.assignments[role] === 'courier round'
              ? 'delivery district'
              : 'depot'
          : 'home',
      action,
      duration,
      mode: action === 'sleep' ? ('sleep' as const) : ('awake' as const),
      effort: action === 'sleep' ? 0 : 0.02,
      advertises: needs,
    };
    const rec = decide(p, [aff]);
    const activity = rec.chosenAffordanceId === aff.id ? begin(p, aff, rec) : null;
    if (activity) {
      tick(p, activity.endsAt);
      finish(p, { affordanceId: aff.id, action, status: 'completed', at: p.now, needs });
    } else tick(p, p.now + duration);
  }
}
/** Called only after HF finishes the selected Dilan action. Third-person state reflects the encounter. */
export function finishCastEncounter(s: GameState, m: Moment, chosen: Opt): string | undefined {
  if (!s.cast) return;
  const sharedShelf = m.id === 'shelf-visit-6' && chosen.id === 'repair-with-aylin';
  const role = sharedShelf
    ? 'aylin'
    : (Object.keys(clues).find((id) => chosen.id === `reveal-${id}`) as CastRole | undefined);
  if (!role) return;
  const c = sharedShelf
    ? { moment: m.id, line: typeof chosen.done === 'string' ? chosen.done : '' }
    : clues[role];
  if (m.id !== c.moment) throw Error('Wrong discovery encounter.');
  if (role !== 'dilan') {
    const p = s.cast.people[role];
    // The participant actually spends this bounded encounter with Dilan. No friendship or qualification is granted.
    if (p.now < s.person.now - chosen.duration)
      companionRoutine(p, s.person.now - chosen.duration, s.cast, role);
    if (p.activity || !p.body.alive)
      return 'They could not finish the conversation. No private confidence was shared.';
    const aff = {
      id: `encounter-${m.id}`,
      label: 'talk with Dilan',
      action: sharedShelf ? 'shelf' : 'chat',
      effort: 0.05,
      duration: chosen.duration + (sharedShelf ? (chosen.alsoDoes?.duration ?? 0) : 0),
      placeId: m.place,
      advertises: { belonging: 0.7, meaning: 0.3 },
    };
    const decision = decide(p, [aff]);
    const activity = decision.chosenAffordanceId === aff.id ? begin(p, aff, decision) : null;
    if (!activity) return 'They could not finish the conversation. No private confidence was shared.';
    tick(p, activity.endsAt);
    finish(p, {
      affordanceId: aff.id,
      action: aff.action,
      status: 'completed',
      at: p.now,
      needs: { belonging: 0.2 },
    });
  }
  s.cast.encounters.push({ person: role, at: s.person.now, action: chosen.action });
  if (!sharedShelf && !s.cast.discoveries.some((x) => x.person === role))
    s.cast.discoveries.push({ person: role, at: s.person.now, line: c.line });
  return c.line;
}
export function castIntroduction(): string {
  return 'Dilan, 33, delivers parcels in Istanbul. Her sister Aylin, 36, cooks school lunches and private meals. Ece, 24, works the depot routes while studying logistics and lives with her aunt. Murat, 27, used to work as a grill cook. He is now a junior supervisor at the depot. Their work does not end when Dilan goes home.';
}
export function cloneCast(cast: CastState): CastState {
  const result = structuredClone(cast);
  for (const role of Object.keys(result.people) as CastRole[])
    result.people[role] = snapshot(cast.people[role]);
  return result;
}

/** Life place and assignment change actual scene/affordance context, not the person's occupation. */
export function castScene(s: GameState, m: Moment, base: string): string {
  if (!s.cast) return base;
  const c = s.cast;
  if (m.id === 'alarm-1' && c.places.dilan && c.places.dilan !== 'home')
    return `Dilan is at ${c.places.dilan === 'public-garden' ? 'the public garden beside the depot' : 'the depot break room'} before her shift. Her phone alarm rings. She can stand up or stay resting. Her next job is ${c.assignments.dilan ?? 'the usual delivery route'}.`;
  if (m.id === 'lunch-2' && c.assignments.ece)
    return `${base} Ece’s current work is ${c.assignments.ece === 'courier round' ? 'a delivery route' : c.assignments.ece}. She is still studying logistics.`;
  if (m.id === 'dinner-3' && c.assignments.aylin)
    return `${base} Aylin has come from ${c.assignments.aylin === 'school kitchen' ? 'the school kitchen' : c.assignments.aylin}. She is here for a family meal.`;
  return base;
}

/** Source checkpoints observe these already-lived states; they never advance a person to pass a gate. */
export function advanceCast(s: GameState, at: number): void {
  if (!s.cast) return;
  for (const role of ['aylin', 'ece', 'murat'] as const)
    companionRoutine(s.cast.people[role], at, s.cast, role);
}

export const CAST_MOMENTS: Moment[] = [
  {
    id: 'shelf-visit-6',
    day: 6,
    at: 8 * 60 + 15,
    window: 20,
    place: 'home',
    when: (c) => c.chosen['shelf-4'] === 'reveal-dilan',
    scene:
      'It is Saturday. Aylin has come for the short visit they agreed on to look at the shelf. The boxes are off the uneven support. “Show me what catches,” she says. She has not come to take over.',
    pull: { to: 'leave-shelf', line: 'Have cake. Leave the shelf for another day.' },
    options: [
      {
        id: 'repair-with-aylin',
        ink: 'Stay beside her. Repair the support and finish the shelf together.',
        label: 'repair the shelf with Aylin',
        action: 'shelf',
        duration: 60,
        alsoDoes: { action: 'shelf', duration: 30 },
        effort: 0.25,
        advertises: { competence: 0.3, belonging: 0.25 },
        gives: { competence: 0.3, belonging: 0.25 },
        done: 'Dilan stayed while Aylin held the support. They repaired it and finished the shelf. The crooked edge remained visible inside; they put a book on it together.',
      },
      {
        id: 'leave-shelf',
        ink: 'Have cake together. Say plainly that the repair will wait.',
        label: 'leave the repair for now',
        action: 'chat',
        duration: 20,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.2 },
        done: 'They had cake. Dilan said the shelf was still unfinished instead of pretending that asking for help had finished it.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'repair-with-aylin') s.flags.shelf = 2;
    },
  },
];
export function castMoment(s: GameState, m: Moment): Moment {
  if (!s.cast || m.id !== 'route-3' || s.cast.extraWork.dilan !== false) return m;
  const original = m.options;
  return {
    ...m,
    scene:
      'Murat needs someone to do Ece’s evening deliveries. Dilan has already promised to use her remaining time elsewhere. She cannot promise that time twice. Aylin’s dinner is at half past seven.',
    pull: { to: 'no', line: 'Keep the time you already reserved. Aylin is expecting you.' },
    options: (c) => (typeof original === 'function' ? original(c) : original).filter((o) => o.id !== 'route'),
  };
}
