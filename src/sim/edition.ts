/** Current editions share retained portable-person v2 with canonical rules 0.9.0.
 * Complete notebooks always retain their actual simulation edition for replay. */
export const PROMISE_EDITION = '0.9.0';
export const isCanonicalEdition = (version: string | undefined) =>
  version === '0.6.0' || version === PROMISE_EDITION;
