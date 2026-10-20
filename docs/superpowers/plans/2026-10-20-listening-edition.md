# Listening edition implementation plan

Goal: implement the owner's 2026-10-20 brief and ship edition 0.3.0 while preserving 0.2.1 runs.

Architecture: the game supplies HF with authored choices, temperature and attended advice. HF owns scoring, vetoes, pressure, seeded draws and memory decay. UI copy uses HF likelihood; UI input targets the original card.

Spec: docs/design.md and the owner's brief; common rules in human-framework/scratch/design-round/brief-common.md.

Constraints: exact HF 2.8.0 pin; no framework changes; seeded state only; no feeling meters; legacy exports retain edition; lead designer accepts feel separately.

1. Capture canonical full-state SHA-256 fixtures before sim edits: three seeds, silence/opposition/insistence/mixed policies, three midweek checkpoints with restored continuations each. Add edition tests; observe the new-edition assertion fail.
2. Add version arguments to creation/replay; branch new simulation configuration. Use HF temperature for plain choices and HF standing advice for eligible gentle refusals. Test trust, pressure, hard vetoes, close Monday calls, recall, deterministic replay and hint calibration.
3. Bind UI input to card identity across replacement; show time remaining and retained-thought traces. Persist/export/import the actual edition. Add browser tests and touch renders at 360x690 plus 1280x800.
4. Measure old/new policies over at least eight seeds. Record against-leaning landing rates, refusals later surfaced, mood calibration and edge/honest results without treating any scalar as a complete definition of a good week.
5. Review correctness and evidence independently. Fix verified findings. Run npm run check; commit explicitly staged files with required trailer; push main; deploy; verify live release and CI; save live phone render; write requested report.

Review focus: unversioned saves, conflicting edition metadata, retained advice that is blocked or never returns, reading hints consuming RNG, and a finger held across expiry. Each has an edition, simulation or browser regression test.
