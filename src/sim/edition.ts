/** Served HF4.9 rules stay exact. Remainder behavior is an explicit new edition. */
export const PROMISE_EDITION = '0.9.0';
export const REMAINDER_EDITION = '0.10.0';
export const isRemainderEdition = (v: string | undefined) =>
  v === '0.10.0' || v === '0.10.1' || v === '0.10.2';
export const isHf4Edition = (v: string | undefined) =>
  v === '0.9.0' || v === '0.9.1' || v === '0.9.2' || isRemainderEdition(v);
export const isThreeWeekEdition = (v: string) => v === '0.9.1' || v === '0.10.1';
export const isOutcomesEdition = (v: string) => v === '0.9.2' || v === '0.10.2';
export const sourceRules = (v: string) => {
  if (!isHf4Edition(v)) throw Error(`Unknown Murmur source edition: ${v}`);
  return isRemainderEdition(v) ? REMAINDER_EDITION : PROMISE_EDITION;
};
export const isCanonicalEdition = (v: string | undefined) =>
  v === '0.6.0' || v === PROMISE_EDITION || v === REMAINDER_EDITION;
