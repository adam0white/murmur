/** Simulation editions share the finite canonical passport projection dialect (0.6.0).
 * Complete notebooks always retain their actual simulation edition for replay. */
export const PROMISE_EDITION = '0.6.1';
export const isCanonicalEdition = (version: string | undefined) =>
  version === '0.6.0' || version === PROMISE_EDITION;
