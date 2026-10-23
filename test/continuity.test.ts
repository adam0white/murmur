import { createPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';

const events = vi.hoisted(() => {
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
async function linked(scope: 'shared' | 'file' = 'shared') {
  state = { owner: {}, heads: [{ head: await source(), scope }] };
  await gateContinuity(state);
  return state;
}
it('closes uploads before awaiting central consent bootstrap or historical query', async () => {
  state = { owner: {}, heads: [{ head: await source(), scope: 'shared' }] };
  let ready!: (value: boolean) => void;
  fake.ready = new Promise((resolve) => {
    ready = resolve;
  });
  const gate = gateContinuity(state);
  expect(recording.setPersonaRecording).toHaveBeenCalledWith('test-branch');
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(false);
  expect(fake.request).not.toHaveBeenCalled();
  ready(true);
  await gate;
  expect(fake.request).toHaveBeenCalledOnce();
});
it('requires the selected pinned head echo and accepts same-epoch cross-origin linkage without a new choice', async () => {
  const current = await linked();
  fake.request.mockImplementation(async (req) => reply(req, true));
  await gateContinuity(current);
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(true);
  fake.request.mockImplementation(async (req) => ({ ...reply(req, true), revision: 'different' }));
  recording.allowPersonaRecording.mockClear();
  await gateContinuity(current);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  expect(fake.request.mock.lastCall?.[0].envelope).toEqual(current.heads[0]?.head);
});
it('ignores stale query responses after identity changes or loaded-run replacement', async () => {
  const original = await linked();
  let resolve!: (value: ReturnType<typeof reply>) => void;
  let seen!: () => void;
  const queried = new Promise<void>((r) => {
    seen = r;
  });
  fake.request.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
        seen();
      }),
  );
  const gate = gateContinuity(original);
  await queried;
  invalidateContinuity();
  state = { owner: {}, heads: [] };
  recording.allowPersonaRecording.mockClear();
  resolve(reply({ envelope: original.heads[0]?.head }, true));
  await gate;
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('queries a fresh epoch before persisting selected explicit denial', async () => {
  const current = await linked();
  fake.request.mockClear();
  await chooseContinuityRecording(false);
  const writes = fake.request.mock.calls.filter(([req]) => req.allowRecording !== undefined);
  expect(writes).toHaveLength(1);
  expect(writes[0]?.[0]).toMatchObject({
    envelope: current.heads[0]?.head,
    recordingEpoch: 'opaque-epoch',
    allowRecording: false,
  });
  expect(recording.allowPersonaRecording).toHaveBeenLastCalledWith(false);
});
it('serializes an already sent grant before a newer denial without reopening local uploads', async () => {
  const current = await linked();
  let resolve!: (value: ReturnType<typeof reply>) => void;
  let sent!: () => void;
  const granted = new Promise<void>((r) => {
    sent = r;
  });
  const writes: boolean[] = [];
  fake.request.mockImplementation(async (req) => {
    if (req.allowRecording !== undefined) writes.push(req.allowRecording);
    if (req.allowRecording === true) {
      sent();
      return new Promise((r) => {
        resolve = r;
      });
    }
    return reply(req, req.allowRecording !== false);
  });
  recording.allowPersonaRecording.mockClear();
  const older = chooseContinuityRecording(true);
  await granted;
  const newer = chooseContinuityRecording(false);
  resolve(reply({ envelope: current.heads[0]?.head }, true));
  await Promise.all([older, newer]);
  expect(writes).toEqual([true, false]);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('storage identity invalidation stops a pending grant before it can be sent', async () => {
  const original = await linked();
  let resolve!: (value: ReturnType<typeof reply>) => void;
  let seen!: () => void;
  const queried = new Promise<void>((r) => {
    seen = r;
  });
  fake.request.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
        seen();
      }),
  );
  const choice = chooseContinuityRecording(true);
  await queried;
  fake.request.mockImplementation(async (req) => reply(req, false));
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: 'hf-lab-player' });
  events.dispatchEvent(event);
  resolve(reply({ envelope: original.heads[0]?.head }, true));
  await choice;
  expect(fake.request.mock.calls.some(([req]) => req.allowRecording === true)).toBe(false);
});
it('file history cannot inherit a central shared association after denial and reload', async () => {
  const original = await linked('file');
  await chooseContinuityRecording(false);
  state = { ...original, owner: {} };
  fake.request.mockClear();
  fake.request.mockImplementation(async (req) => reply(req, true));
  recording.allowPersonaRecording.mockClear();
  await gateContinuity(state);
  expect(fake.request).not.toHaveBeenCalled();
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});
it('a bridge failure or invalid missing history remains blocked', async () => {
  await linked();
  fake.request.mockRejectedValue(new Error('bridge blocked'));
  recording.allowPersonaRecording.mockClear();
  await gateContinuity(state);
  expect(recording.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  state = { owner: {}, heads: [], invalidHistory: true };
  await gateContinuity(state);
  expect(recording.setPersonaRecording).toHaveBeenLastCalledWith('invalid-history');
});
it('captures authored epoch before source work and refuses publication after a generation change', async () => {
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
  expect(fake.request.mock.lastCall?.[0]).toMatchObject({ authored: true, recordingEpoch: 'source-epoch' });
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
