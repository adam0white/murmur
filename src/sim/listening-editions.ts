import { isHf4Edition } from './edition.ts';
export const listens = (s: { version: string }) => isHf4Edition(s.version);
