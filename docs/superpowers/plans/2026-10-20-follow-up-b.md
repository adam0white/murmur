# Murmur follow-up b implementation plan

Goal: keep live choices reachable and make retained words lead to one distinct result.

Spec: the ranked follow-up in this session; common brief at `human-framework/scratch/design-round/brief-common.md`. The appended report is the delivery artifact. The lead designer accepts the round; the owner accepts feel.

Constraints: preserve 052ad26's 0.3.0 full state, input rules, HF 2.8.0 pin and RNG. Use presentation projections only. Ship on main as requested.

- [x] Capture 12 complete 0.3.0 runs and 36 checkpoint continuations before source edits; test alongside 0.2.1.
- [x] Reproduce lingering reply in Chromium, then test visible, answerable next cards at both requested sizes without clicking the acceleration control. Label acceleration literally.
- [x] Add failing presentation tests for recall on the first related card only, a distinct resolved result, situation-specific refusal/retention words, and a quiet kept-phrase margin. Reconstruct from recorded provenance; never mutate it.
- [x] Render final input provenance from Saturday's recorded answer: held compliance, held refusal, ordinary suggestion and explicit/timeout silence.
- [x] Remove bedtime reassurance repetition. Test DOM wiring, reload/import reconstruction and state purity.
- [x] Defer Friday coffee replacement to 2026-11-03 with a reason in design.md. Record costs and UI reversal.
- [ ] Review with independent replay and UI lenses. Run self-play, renders with -b suffix, npm run check, signed Codex-trailer commit, push, deploy, matching clean release and green CI.

Review focus: earlier final holds must not mark Saturday as pressed; held refusals must not read as compliance; recall must not recur after import or another day; a new reply must not obstruct the next card; kept words must fit a three-option phone card.

Verification before shipping: npm run check passed lint, TypeScript and 100/100 tests. Two independent reviewers checked replay/provenance and UI/copy. Corrected conditional Mum/Aylin and Murat/Ece names with RED-to-GREEN tests. Final shipping evidence belongs in the external Follow-up b report, including the commit and clean live release. The requested main integration is authorized in the task.
