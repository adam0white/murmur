/** Canonical Murmur cast authoring for one community run. All clocks entering HF are milliseconds. */
import {
  createPerson,
  createRun,
  DEFAULT_NORMS,
  type PersonAuthoring,
  type PortableAdmission,
  type Run,
  type RunSpec,
} from '@adam0white/human-framework';
import { castForGame } from '@adam0white/lab-client';
import { MURMUR_PLACES } from './hf4-history.ts';
import { murmurLexicon } from './hf4-narration.ts';

const MINUTE = 60_000;
const DAY = 86_400_000;
const START = (400 * 1440 + 6 * 60 + 39) * MINUTE;
const day = (index: number) => (400 + index - 1) * DAY;
const role = (castId: string) => castId.split('.')[2] ?? '';
const tie = (otherId: string, kind: 'parent' | 'sibling' | 'colleague') => ({
  otherId,
  roles: [kind],
  ledger: 0,
  lastInteraction: START,
  ...(
    {
      parent: { affection: 0.6, trust: 0.75, familiarity: 0.9, respect: 0.5 },
      sibling: { affection: 0.45, trust: 0.65, familiarity: 0.85, respect: 0.2 },
      colleague: { affection: 0.1, trust: 0.55, familiarity: 0.4, respect: 0.15 },
    } as const
  )[kind],
});
const jitter = (seed: number, salt: number) => {
  let x = (seed * 2654435761 + salt * 40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  return ((x % 1000) / 1000 - 0.5) * 0.12;
};

export function createMurmurOpening(
  seed: number,
  actionIds: readonly string[],
  portable: Record<string, PortableAdmission> = {},
): Run {
  const cast = castForGame('murmur');
  const bindings = Object.values(portable).flatMap((p) => p.mapping.references);
  const actions = [
    ...new Set([...actionIds, ...bindings.filter((b) => b.kind === 'action').map((b) => b.target)]),
  ];
  const historyEntities = bindings.filter(
    (b) => b.kind === 'entity' && b.target.startsWith('murmur-history:'),
  );
  const historySources = [
    ...new Set(
      bindings
        .filter((b) => b.kind === 'source' && b.target.startsWith('murmur-history:'))
        .map((b) => b.target),
    ),
  ];
  if (
    !['get-up', 'snooze', 'scroll', 'coffee', 'call-mum', 'dinner', 'shelf'].every((id) =>
      actions.includes(id),
    )
  )
    throw new Error('The Murmur action catalogue is incomplete');
  const spec: RunSpec = {
    id: 'murmur',
    seed,
    start: START,
    host: { id: 'murmur', edition: 'hf4', schema: 'murmur-hf4/1' },
    tuning: { promptings: { practiceHalfLifeDays: 3.1062837195053903 } },
    definitions: {
      actions: actions.map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: 'awake', requires: {} },
        tags: [],
        norms: [],
      })),
      norms: structuredClone(DEFAULT_NORMS),
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        { type: 'host', id: 'murmur' },
        ...historySources.map((id) => ({ type: 'voice' as const, id })),
        { type: 'voice', id: 'you' },
        { type: 'voice', id: 'pull' },
        ...[...cast.map((c) => role(c.castId)), 'mum'].map((id) => ({ type: 'person' as const, id })),
      ],
      lexicon: murmurLexicon(Object.fromEntries(cast.map((entry) => [role(entry.castId), entry.name]))),
      calendar: {
        id: 'murmur-calendar',
        epoch: { id: 'epoch', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: [],
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: [
        ...MURMUR_PLACES.map((id) => ({
          id: `place:${id}`,
          subject: id,
          predicate: 'authored-place',
          value: true,
          at: START,
          provenance: { source: 'murmur', evidenceId: `murmur:place:${id}` },
        })),
        ...historyEntities.map((b) => ({
          id: `declared:${b.target}`,
          subject: b.target,
          predicate: 'retained-source-reference',
          value: { sourceReference: b.source },
          at: START,
          provenance: { source: 'murmur', evidenceId: `retained:${b.target}` },
        })),
      ],
      hostState: { active: [], completed: [] },
    },
  };
  const result = createRun(spec);
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  const run = result.value;
  for (const entry of cast) {
    const id = role(entry.castId);
    if (!['dilan', 'aylin', 'ece', 'murat'].includes(id)) throw new Error('Unknown Murmur cast member');
    const dilan = id === 'dilan';
    const relationships =
      id === 'dilan' || id === 'aylin'
        ? [tie(id === 'dilan' ? 'aylin' : 'dilan', 'sibling'), tie('mum', 'parent')]
        : [];
    if (id === 'dilan' || id === 'ece')
      relationships.push(tie(id === 'dilan' ? 'ece' : 'dilan', 'colleague'));
    const held = [
      ['punctuality', 'recommended', 0.6],
      ['lying', 'forbidden', 0.2],
      ['backbiting', 'forbidden', 0.22],
      ['kindness-to-parents', 'obligatory', 0.5],
      ['keep-promise', 'obligatory', 0.3],
      ['help-neighbor', 'recommended', 0.5],
      ['gratitude', 'recommended', 0.5],
    ] as const;
    const authoring: PersonAuthoring = {
      id,
      ...(portable[id] ? { portable: portable[id] } : {}),
      identity: {
        name: entry.name,
        birthAt: START - entry.age * 365 * DAY,
        sex: id === 'murat' ? 'male' : 'female',
        castId: entry.castId,
      },
      biography: [],
      origin: {
        kind: 'authored',
        basis: { kind: 'evidence', id: `murmur:cast:${id}` },
        traits: { kind: 'explicit-authoring', evidence: { kind: 'evidence', id: `murmur:traits:${id}` } },
      },
      state: {
        traits: { ...entry.traits },
        values: { ...entry.values },
        body: {
          satiety: 0.8,
          hydration: 0.85,
          sleepPressure: 0.2,
          exertion: 0,
          fitness: 0.5,
          health: 1,
          pain: 0,
          sleepDebtHours: 0,
          depletion: 0,
          circadianPeakMs: 16 * 60 * MINUTE,
          asleep: false,
          since: START,
          doze: {
            context: { posture: 'upright', stimulation: 0.5 },
            basis: { kind: 'authored', author: 'murmur', at: START },
          },
          bladder: { fill: 0, pending: 0 },
          injuries: [],
          illnesses: [],
          exposures: [],
        },
        needs: {
          safety: 0.8,
          belonging: 0.7,
          esteem: 0.6,
          autonomy: 0.7,
          competence: 0.6,
          leisure: 0.6,
          meaning: 0.6,
        },
        skills: [],
        heldNorms: dilan
          ? held.map(([normId, standing, conviction]) => {
              const norm = DEFAULT_NORMS.find((n) => n.id === normId);
              if (!norm) throw new Error(`Missing norm ${normId}`);
              return { normId, standing, conviction, provenance: norm.provenance };
            })
          : [],
        beliefs: [],
        consequences: [],
        sourceTrust: [],
        context: {
          scarcity: { kind: 'prior', value: 0, basis: 'engineering:source-zero-context' },
          smoking: { kind: 'unobserved' },
        },
        relationships,
        voices: dilan
          ? [
              { voiceId: 'you', trust: 0.5 },
              { voiceId: 'pull', trust: 0.6 },
            ]
          : [],
        agenda: {
          exemptions: { traveling: { kind: 'unobserved' }, illnessSeverity: { kind: 'unobserved' } },
          commitments: dilan
            ? [
                {
                  id: 'alarm',
                  kind: 'promise',
                  toId: 'self',
                  label: 'my alarm',
                  actions: ['get-up'],
                  from: day(1) + (6 * 60 + 35) * MINUTE,
                  until: day(1) + 7 * 60 * MINUTE,
                  importance: 0.5,
                  recurEveryMs: DAY,
                  recurUntil: day(5) + 1439 * MINUTE,
                },
                {
                  id: 'mum',
                  kind: 'promise',
                  toId: 'mum',
                  label: 'my call to Mum',
                  actions: ['call-mum'],
                  from: day(1) + (17 * 60 + 30) * MINUTE,
                  until: day(1) + (21 * 60 + 30) * MINUTE,
                  importance: 0.55,
                  recurEveryMs: DAY,
                  recurUntil: day(5) + 1439 * MINUTE,
                },
                {
                  id: 'aylin',
                  kind: 'promise',
                  toId: 'aylin',
                  label: 'my word to Aylin',
                  actions: ['dinner'],
                  from: day(3) + (19 * 60 + 30) * MINUTE,
                  until: day(3) + 21 * 60 * MINUTE,
                  importance: 0.6,
                },
              ]
            : [],
          // HF4 requires a completion horizon; seven days is this edition's authored estimate.
          goals: dilan
            ? [
                {
                  id: 'shelf',
                  label: 'the shelf',
                  serves: ['competence', 'meaning'],
                  progress: 0.1,
                  advancedBy: [{ action: 'shelf', amount: 0.45 }],
                  importance: 0.35,
                  baseImportance: 0.35,
                  completionHalfLifeMs: 7 * DAY,
                },
              ]
            : [],
          precommitments: [],
          owed: [],
        },
        family: { contactCovered: [], aptitudes: {} },
        groups: [],
        reserve: {},
        retention: { trace: 32, chronicleDays: 120 },
        habits: dilan
          ? [
              {
                cue: { placeId: 'bed' },
                action: 'snooze',
                strength: 0.78 + jitter(seed, 1),
                repetitions: 400,
                lastAt: START - DAY,
              },
              {
                cue: { placeId: 'phone' },
                action: 'scroll',
                strength: 0.75 + jitter(seed, 2),
                repetitions: 900,
                lastAt: START - DAY,
              },
              {
                cue: { placeId: 'depot' },
                action: 'coffee',
                strength: 0.45 + jitter(seed, 3),
                repetitions: 300,
                lastAt: START - DAY,
              },
            ]
          : [],
        expectations: [],
        affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.3, emotions: [] },
        promptings: {
          reading: dilan ? 'inclination' : 'none',
          ...(dilan ? { readingSource: 'murmur:dilan' } : {}),
          responses: [],
        },
        review: {
          style: dilan ? 'ruminating' : 'none',
          ...(dilan ? { styleSource: 'murmur:dilan' } : {}),
          atMsOfDay: 22 * 60 * MINUTE,
        },
        bonds: { courtships: [], marriages: [] },
      },
    };
    if (portable[id]) {
      // Incoming memory, held norms and responsibilities have one owner: the retained admission.
      // A fresh opening must not replace them with this story's default promises or shelf goal.
      authoring.state.heldNorms = [];
      authoring.state.agenda.commitments = [];
      authoring.state.agenda.goals = [];
    }
    const admitted = createPerson(run, authoring);
    if (!admitted.ok)
      throw new Error(`${admitted.error.code} ${admitted.error.path}: ${admitted.error.message}`);
  }
  return run;
}
