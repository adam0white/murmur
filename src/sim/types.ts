import type { FollowOn, NeedId, NormTag, Person, PromptingResponseKind } from '@adam0white/human-framework';

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
  day: number;
  flags: Flags;
  missedMum: number;
  tired: boolean;
  /** Which option each moment so far ended in. */
  chosen: Record<string, string>;
  /** Saturday's voice note, composed from the week. */
  note: string;
}

export interface Flags {
  late?: boolean;
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
}

export interface LogLine {
  at: number;
  who: 'narrator' | 'dilan' | 'pull' | 'you' | 'other';
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
  borrowedHeard: number;
  /** Cards today where the pull could have borrowed your ink, and where it did. */
  borrowable: number;
  borrowed: number;
  learned: string[];
  trustYouAtStart: number;
  trustPullAtStart: number;
}

export interface Page {
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
  learned: string[];
  hands: { you: number; pull: number };
}

export type Input =
  | { kind: 'say'; at: number; option: string; insist?: boolean }
  | { kind: 'next'; at: number };
export type NewInput = Input extends infer I ? (I extends { at: number } ? Omit<I, 'at'> : never) : never;

export interface Final {
  note: string;
  sent: string;
  phrases: { text: string; weight: number }[];
  unasked: string[];
  strip: { day: number; kept: string[]; missed: string[] }[];
  hands: { start: { you: number; pull: number }; end: { you: number; pull: number } };
  line: string;
}

export interface GameState {
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
}
