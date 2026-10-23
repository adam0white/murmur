import type { FollowOn, NeedId, NormTag, Person, PromptingResponseKind } from '@adam0white/human-framework';
import type { PersonaEnvelope } from '@adam0white/lab-client';
import type { DepartureReceipt } from './one-cast.ts';

/** One thing Dilan could do at a moment. */
export interface Opt {
  id: string;
  /** What you would say, in your ink (imperative, short). */
  ink: string | ((c: Ctx) => string);
  /** HF label: a verb phrase HF puts in her sentences ("After I <label>."). */
  label: string;
  action: string;
  duration: number;
  effort?: number;
  focus?: number;
  /** What she expects from it. */
  advertises?: Partial<Record<NeedId, number>>;
  /** What it actually gave her (psychological needs; world truth). Defaults to the psychological advertisement. */
  gives?: Partial<Record<NeedId, number>> | ((c: Ctx) => Partial<Record<NeedId, number>>);
  tags?: string[];
  norms?: NormTag[];
  followedBy?: FollowOn[];
  placeId?: string;
  /** Commitment labels this option keeps besides those matched by action. */
  keeps?: string[];
  /** A short act the host stages right after (one HF outcome keeps at most one commitment). */
  alsoDoes?: { action: string; duration: number };
  /** A turning-away she can keep as her own phrase, when she follows you here away from a prompt. */
  phrase?: { id: string; kind: PromptingResponseKind; text: string };
  /** Journal line once done (narrator, past tense). */
  done: string | ((c: Ctx) => string);
}

export interface Moment {
  id: string;
  day: number;
  /** Minute of day the card opens (at the earliest). */
  at: number | ((c: Ctx) => number);
  /** Sim minutes the card stays open. */
  window?: number;
  place: string;
  when?: (c: Ctx) => boolean;
  scene: string | ((c: Ctx) => string);
  pull: {
    to: string;
    line: string | ((c: Ctx) => string);
    /** On Thursday and Friday, when she trusts you more than the pull, the pull says this in your ink. */
    borrow?: string;
    /** How hard the pull pushes here (default 0.6); tiredness adds to it. */
    strength?: number;
  };
  options: Opt[] | ((c: Ctx) => Opt[]);
  /** A one-line hint shown the first time (progressive disclosure). */
  hint?: string;
  after?: (s: GameState, chosen: string) => void;
}

/** What content functions may read. */
export interface Ctx {
  /** Edition used for authored copy; omitted by legacy direct content callers. */
  version?: string;
  day: number;
  flags: Flags;
  missedMum: number;
  tired: boolean;
  /** Which option each moment so far ended in. */
  chosen: Record<string, string>;
  /** Saturday's voice note, composed from the week. */
  note: string;
  /** 1 for the first week (days 1-6), 2 for the second (days 8-13; day 7 is an offstage Sunday). */
  week: number;
  /** 1 = Monday ... 6 = Saturday, in either week. */
  weekday: number;
  /** Her learned phrases, strongest practice first (HF prompting responses she kept from your words). */
  phrases: { id: string; text: string; practice: number }[];
  /** Week one's last page, once the run has gone on to a second week. Week two must not contradict it. */
  weekOne?: Final;
}

export interface Flags {
  late?: boolean;
  /** Mornings she has walked in late this week. */
  lateDays?: number;
  lied?: number;
  gossiped?: number;
  helpedEce?: boolean;
  eceBlamed?: boolean;
  ownedMistake?: boolean;
  coffee?: number;
  route?: boolean;
  bowling?: boolean;
  gym?: boolean;
  shelf?: number;
  wrote?: number;
  wroteTonight?: boolean;
  bedAt?: number;
  calls?: number;
  sent?: string;
  /** Week-two content state, owned by src/sim/week2.ts (keys are that file's to name). */
  w2?: Record<string, string | number | boolean>;
}

export type Verdict = 'assented' | 'complied' | 'deferred' | 'modified' | 'refused' | 'commanded';

export interface Card {
  moment: string;
  openedAt: number;
  closesAt: number;
  borrowed: boolean;
}

export interface Answer {
  moment: string;
  at: number;
  chosen: string;
  said?: string;
  insisted?: boolean;
  verdict?: Verdict;
  says?: string;
  borrowed: boolean;
  /** She turned from a prompt with her own phrase, with nothing from you. */
  turnedAlone?: string;
  /** She kept a new phrase of yours as her own. */
  learned?: string;
  pullWon: boolean;
  /** Her immediate acknowledgement of retained, unforced advice. */
  stayed?: string;
  /** Earlier advice resurfacing at this related moment. */
  recalled?: string;
}

export interface LogLine {
  at: number;
  who: 'narrator' | 'dilan' | 'pull' | 'you' | 'other' | 'scene';
  text: string;
}

export interface DayStats {
  said: number;
  insisted: number;
  heard: number;
  refused: number;
  silent: number;
  pullWon: number;
  turnedAlone: string[];
  /** A week-two morning whose alarm she handled without a card. */
  gotUpAlone?: boolean;
  borrowedHeard: number;
  /** Cards today where the pull could have borrowed your ink, and where it did. */
  /** Phrases you said again today (they keep); the rest fade overnight. */
  reinforced: string[];
  borrowable: number;
  borrowed: number;
  learned: string[];
  trustYouAtStart: number;
  trustPullAtStart: number;
}

export interface Page {
  stayed?: string[];
  day: number;
  review?: string;
  style: string;
  kept: string[];
  missed: string[];
  resolves: { label: string; marks: number }[];
  aboutYou: string;
  herLine: string;
  phrases: { text: string; weight: number }[];
  turnedAlone: string[];
  /** A week-two morning whose alarm she handled without a card. */
  gotUpAlone?: boolean;
  learned: string[];
  hands: { you: number; pull: number };
}

export type Input =
  | { kind: 'say'; at: number; option: string; insist?: boolean }
  | { kind: 'quiet'; at: number }
  | { kind: 'next'; at: number }
  | { kind: 'one-cast-release'; at: number };
export type NewInput = Input extends infer I ? (I extends { at: number } ? Omit<I, 'at'> : never) : never;

export interface Final {
  note: string;
  sent: string;
  phrases: { text: string; weight: number }[];
  unasked: string[];
  /** What became of the week's open threads (Ece, Murat, the shelf, the photo). */
  threads: string[];
  strip: { day: number; kept: string[]; missed: string[] }[];
  hands: { start: { you: number; pull: number }; end: { you: number; pull: number } };
  line: string;
}

export interface OneCastRow {
  v: 1;
  probe: 'dilan';
  arm: 'fresh' | 'biography' | 'continuing';
  scope: 'shared' | 'local' | 'file';
  castId: string;
  branchId: string;
  revision: string;
  parentRevision: string | null;
  stage: string;
  outcome: string;
}
export interface ReturnChapter {
  prefixInputs: Input[];
  prefixMinute: number;
  envelope: PersonaEnvelope;
  departure: PersonaEnvelope;
  initialPerson: Person;
}
export interface GameState {
  fileHistory?: boolean;
  oneCastDeparture?: DepartureReceipt;
  personaHead?: PersonaEnvelope;
  personaScope?: 'shared' | 'local' | 'file';
  oneCast?: OneCastRow[];
  returnChapter?: ReturnChapter;

  version: string;
  seed: number;
  day: number;
  phase: 'day' | 'evening' | 'end';
  minute: number;
  person: Person;
  inputs: Input[];
  applied: number;
  queue: string[];
  card: Card | null;
  answer: Answer | null;
  log: LogLine[];
  flags: Flags;
  stats: DayStats;
  pages: Page[];
  phrases: { id: string; text: string }[];
  chosen: Record<string, string>;
  hinted: string[];
  final: Final | null;
  /** Earlier weeks' last pages, oldest first (edition 0.4.0, after "Another week"). */
  past?: Final[];
  /** Provenance for retained HF advice, never a parallel score. */
  thoughts?: {
    moment: string;
    at: number;
    action: string;
    ink: string;
    label: string;
    surfacedAt?: number;
  }[];
}
