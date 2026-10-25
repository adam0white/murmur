import { createPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  return target;
});
const fake = vi.hoisted(() => ({
  enabled: true,
  ready: Promise.resolve(true),
  request: vi.fn(),
  setEnabled: vi.fn(),
}));
const recording = vi.hoisted(() => ({
  setPersonaRecording: vi.fn(),
  allowPersonaRecording: vi.fn(),
  personaRecordingAllowed: false,
  telemetryOn: true,
}));
vi.mock('@adam0white/lab-client', async (original) => ({
  ...(await original<object>()),
  personaChannel: () => fake,
  watchPersonaCheckpoint: () => () => {},
}));
vi.mock('../src/ui/lab', () => ({ lab: recording }));

import {
  type ContinuityRecordingState,
  chooseContinuityRecording,
  claimPersona,
  departureGuardCurrent,
  gateContinuity,
  installContinuity,
  invalidateContinuity,
  publishPersona,
  recordingEpochGuard,
  reduceLocalPersona,
} from '../src/ui/continuity';

let state: ContinuityRecordingState | undefined;
const source = (branchId = 'test-branch', parentRevision: string | null = null) =>
  createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.dilan.murmur',
    castRevision: '1',
    branchId,
    parentRevision,
    source: { game: 'murmur', build: 'test', engine: '2.14.1', rules: 'murmur-test' },
    transfer: { test: true },
    limitations: [],
  });
const reply = (req: { envelope?: PersonaEnvelope }, sameEpoch: boolean) => ({
  sameEpoch,
  recordingEpoch: 'opaque-epoch',
  branchId: req.envelope?.branchId,
  revision: req.envelope?.revision,
});
beforeEach(() => {
  invalidateContinuity();
  state = undefined;
  installContinuity(
    () => state,
    () => {},
  );
  fake.enabled = true;
  fake.ready = Promise.resolve(true);
  fake.request.mockReset();
  fake.request.mockImplementation(async (req) => (req.action === 'put' ? req.envelope : reply(req, false)));
  recording.personaRecordingAllowed = false;
  recording.telemetryOn = true;
  recording.setPersonaRecording.mockClear();
  recording.allowPersonaRecording.mockClear();
});
it('captures authored ownership before source work and refuses publication after a generation change', async () => {
  state = { owner: {}, heads: [] };
  await gateContinuity(state);
  recording.personaRecordingAllowed = true;
  fake.request.mockImplementation(async (req) =>
    req.action === 'put' ? req.envelope : { recordingEpoch: 'source-epoch' },
  );
  const guard = await recordingEpochGuard();
  expect(guard.authored).toBe(true);
  const envelope = await source();
  await publishPersona(envelope, { guard });
  expect(fake.request.mock.lastCall?.[0]).toMatchObject({ authored: true });
  invalidateContinuity();
  expect(departureGuardCurrent(guard)).toBe(false);
  await expect(publishPersona(envelope, { guard })).rejects.toThrow(/changed/);
});
it('creates different admission attempts and preserves the actual selected source parent', async () => {
  const envelope = await source();
  const host = { ...envelope.source, game: 'hearsay' };
  const one = await claimPersona(envelope, host, { mapping: 'murmur-hearsay/1' });
  const two = await claimPersona(envelope, host, { mapping: 'murmur-hearsay/1' });
  expect(one.parentRevision).toBe(envelope.revision);
  expect(two.revision).not.toBe(one.revision);
  expect((one.transfer.admission as { claimId: string }).claimId).toMatch(/^[a-f0-9-]{36}$/);
});
it('file CAS bootstraps one selected historical boundary but rejects competing retained claims', async () => {
  const envelope = await source('file-branch', 'a'.repeat(64));
  const { revision, ...body } = envelope;
  const claim = await createPersona({ ...body, parentRevision: revision, transfer: { attempt: 1 } });
  let local = reduceLocalPersona(undefined, claim, { arrival: envelope });
  expect(local.heads[claim.castId]).toBe(claim.revision);
  const next = await createPersona({ ...body, parentRevision: claim.revision, transfer: { attempt: 2 } });
  local = reduceLocalPersona(local, next);
  expect(() => reduceLocalPersona(local, claim, { arrival: envelope })).toThrow(/conflict/);
  expect(() => reduceLocalPersona(local, claim, { fork: true })).toThrow(/conflict/);
});

it('history binding and checkpoint capture require no recording RPC even with recording off', async () => {
  recording.telemetryOn = false;
  fake.request.mockImplementation(async () => {
    throw new Error('obsolete recording RPC');
  });
  state = { owner: {}, heads: [] };
  await gateContinuity(state);
  await chooseContinuityRecording(true);
  const guard = await recordingEpochGuard();
  expect(guard.authored).toBe(true);
  expect(fake.request).not.toHaveBeenCalled();
});
