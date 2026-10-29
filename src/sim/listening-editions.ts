/** Editions with gentle suggestions and retained HF advice. */
import { isCanonicalEdition, isRemainderEdition } from './edition.ts';

const LISTENING_EDITION = '0.3.0';
/** Editions with gentle suggestions and retained HF advice. */
export const listens = (s: { version: string }) =>
  isRemainderEdition(s.version) ||
  s.version === '0.9.2' ||
  s.version === '0.9.1' ||
  isCanonicalEdition(s.version) ||
  s.version === '0.5.0' ||
  s.version === LISTENING_EDITION ||
  s.version === '0.4.0' ||
  s.version === '0.4.1' ||
  s.version === '0.4.2';
