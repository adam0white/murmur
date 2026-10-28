/** Current game views come from HF inspection, never from the archive's actor internals. */
import { inspect, type PersonView, type Run } from '@adam0white/human-framework';

type HostView = Extract<PersonView, { kind: 'host' }>;
type HostPart = HostView['parts'][number];
type Part<K extends HostPart['select']> = Extract<HostPart, { select: K }>['value'];

function inspectPerson(run: Run, person: string) {
  const result = inspect(run, {
    perspective: { kind: 'host' },
    people: [person],
    select: ['body', 'relationships', 'agenda', 'promptings', 'review', 'advice'],
  });
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  const view = result.value.people[0];
  if (!view || view.kind !== 'host') throw new Error('Missing Dilan inspection');
  const parts = view.parts;
  function part<K extends HostPart['select']>(select: K): Part<K> {
    const found = parts.find((p) => p.select === select);
    if (!found) throw new Error(`Missing Dilan ${select}`);
    return found.value as Part<K>;
  }
  return {
    at: result.value.at,
    body: part('body'),
    relationships: part('relationships'),
    agenda: part('agenda'),
    promptings: part('promptings'),
    review: part('review'),
    advice: part('advice'),
  };
}

export function readDilanEvents(run: Run) {
  const result = inspect(run, {
    perspective: { kind: 'person', observer: 'dilan' },
    people: ['dilan'],
    select: ['events'],
  });
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  return result.value.events;
}

const readings = new WeakMap<Run, Map<string, ReturnType<typeof inspectPerson>>>();
export function invalidateReadings(run: Run): void {
  readings.delete(run);
}
export function readPerson(run: Run, person: string) {
  let cache = readings.get(run);
  if (!cache) {
    cache = new Map();
    readings.set(run, cache);
  }
  let view = cache.get(person);
  if (!view) {
    view = inspectPerson(run, person);
    cache.set(person, view);
  }
  return view;
}
export const readDilan = (run: Run) => readPerson(run, 'dilan');
