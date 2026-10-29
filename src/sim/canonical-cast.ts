/** Four maintained people. Private clues require a completed chosen encounter, never a passport. */
import { castForGame } from '@adam0white/lab-client';
import { playEncounter } from './hf4-encounter.ts';
import { readDilan } from './hf4-read.ts';
import type { GameState, Moment, Opt } from './types.ts';
export const CAST_VERSION = '0.10.0';
export const CAST = castForGame('murmur');
export type CastRole = 'dilan' | 'aylin' | 'ece' | 'murat';
export const roleOf = (castId: string): CastRole => {
  const c = CAST.find((c) => c.castId === castId);
  if (!c) throw new Error('Not a Murmur cast identity.');
  return c.castId.split('.')[2] as CastRole;
};
export interface CastState {
  pauses?: Partial<
    Record<CastRole, { at: number; purposes: { id: string; label: string; progress: number }[] }>
  >;
  discoveries: { person: CastRole; at: number; line: string }[];
  encounters: { person: CastRole; at: number; action: string }[];
  assignments: Partial<Record<CastRole, string>>;
  contacts: Partial<Record<CastRole, string[]>>;
  places: Partial<Record<CastRole, string>>;
  extraWork: Partial<Record<CastRole, boolean>>;
}
export function freshCast(_seed: number): CastState {
  return {
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
  { moment: string; ink: string; label?: string; action: string; duration: number; line: string }
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
    ink: 'Decline the extra route. Ask Murat to show who got each delivery.',
    label: 'Decline the extra route. Ask Murat to open the allocation record with you.',
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
      label: c.label ?? c.ink,
      action: c.action,
      ...(role === 'aylin' ? { keeps: ['mum'] } : {}),
      duration: c.duration,
      advertises: { belonging: 0.25, meaning: 0.2 },
      gives: { belonging: 0.25, meaning: 0.2 },
      placeId: m.place,
      done: c.line,
    },
  ];
}
/** Dilan's completed action alone cannot establish another person's assent or private disclosure. */
export function finishCastEncounter(s: GameState, m: Moment, chosen: Opt): string | undefined {
  if (!s.cast) return;
  // Authored Friday work: only a second completed HF act establishes joint checking.
  if (m.id === 'handover-5' && chosen.id === 'handover') {
    if (playEncounter(s, 'ece', 'handover-ece', chosen.duration, m.place))
      return 'Together they found a parcel on the wrong sheet. Dilan still had her own late deliveries to route.';
    return 'Ece stayed at the loading bay. Dilan found the wrong-sheet parcel alone. Her own late deliveries still needed routing.';
  }
  if (m.id === 'shelf-visit-6' && chosen.id === 'repair-with-aylin') {
    if (!playEncounter(s, 'aylin', 'shelf', chosen.duration, m.place))
      return 'Dilan worked on the shelf. Aylin did not join the repair; they did not finish it together.';
    return typeof chosen.done === 'string' ? chosen.done : undefined;
  }
  const role = Object.keys(clues).find((id) => chosen.id === `reveal-${id}`) as CastRole | undefined;
  if (!role || m.id !== clues[role].moment) return;
  if (role !== 'dilan' && !playEncounter(s, role, 'chat', chosen.duration, m.place))
    return 'Dilan made the request. No completed reply from the other person was recorded.';
  const agreed = role === 'dilan' && playEncounter(s, 'aylin', 'call-aylin', chosen.duration, m.place);
  if (agreed) s.flags.shelfVisitAgreed = true;
  const line =
    role === 'dilan' && !agreed
      ? clues.dilan.line.replace(
          'They agreed to inspect it together;',
          'Dilan proposed inspecting it together; no reply was completed;',
        )
      : clues[role].line;
  s.cast.encounters.push({ person: role, at: readDilan(s.hf.run).at / 60_000, action: chosen.action });
  if (!s.cast.discoveries.some((x) => x.person === role))
    s.cast.discoveries.push({ person: role, at: s.minute, line });
  return line;
}
export function castIntroduction(): string {
  return 'Dilan, 33, delivers parcels in Istanbul. Her sister Aylin, 36, cooks school lunches and private meals. Ece, 24, works the depot routes while studying logistics and lives with her aunt. Murat, 27, used to work as a grill cook. He is now a junior supervisor at the depot. Their work does not end when Dilan goes home.';
}
export const cloneCast = (cast: CastState): CastState => structuredClone(cast);

/** Life place and assignment change actual scene/affordance context, not the person's occupation. */
export function castScene(s: GameState, m: Moment, base: string): string {
  if (!s.cast) return base;
  const c = s.cast;
  if (m.id === 'alarm-1' && c.places.dilan && c.places.dilan !== 'home')
    return `Dilan is at ${c.places.dilan === 'public-garden' ? 'the public garden beside the depot' : 'the depot break room'} before her shift. Her phone alarm rings. She can stand up or stay resting. Her next job is ${c.assignments.dilan ?? 'the usual delivery route'}.`;
  if (m.id === 'lunch-2' && c.assignments.ece)
    return `${base} Ece is working on ${c.assignments.ece === 'courier round' ? 'a delivery route' : c.assignments.ece}. She is still studying logistics.`;
  if (m.id === 'dinner-3' && c.assignments.aylin)
    return `${base} Aylin has come straight from ${c.assignments.aylin === 'school kitchen' ? 'the school kitchen' : c.assignments.aylin} for a family meal.`;
  return base;
}

/** Source checkpoints observe these already-lived states; they never advance a person to pass a gate. */
export function advanceCast(_s: GameState, _at: number): void {
  /* Shared HF run owns companion time. */
}

export { CAST_MOMENTS } from './cast-moments.ts';
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
