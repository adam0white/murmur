/** A required node must exist after its containing markup has been installed. */
export function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw Error('Required interface element is missing.');
  return value;
}
