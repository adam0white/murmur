# Murmur: Two Voices

[Play Two Voices](https://murmur.adamwhite.work/). You suggest what Dilan should do during an ordinary week. She can agree, refuse or choose another action. Her other inner voice offers its own advice.

Fresh runs use edition 0.6.1 on HF 3.0.0. Week two adds a bedtime promise and asks Dilan to finish a call after dialling. Saved editions keep their original rules and replay.

## How to play

1. Choose **Start**, or **Resume** to open the week saved in this browser. Starting a new game asks before replacing a saved week.
2. Read the scene and the other voice’s pencil handwriting. Tap a choice to suggest it. Press and hold to insist; this costs trust and works only while she trusts you. Keyboard players can use Shift+Enter to insist on the selected choice.
3. Choose **Say nothing** to let her decide without your advice. The words below each choice describe her feelings, not numerical odds. Each choice allows 64 real seconds. Time passes faster between choices.
4. Read her response and journal. Each evening shows what she kept, missed and intends to do. Saturday closes the week. **Another week**, when available, continues with the same Dilan into the second authored week.

Open **Information** for help with the current screen. **Game menu** pauses play and offers Feedback, Full screen, New game, All games and the recording switch. Ordinary play uses automatic pace.

## What Human Framework contributes

HF models the person making the decision: bodily needs and fatigue, trust in the two voices, commitments, promptings, learned responses and evening review. Murmur supplies the scenes, available actions, timing, journal and two-week story. The framework predicts each option’s lean and resolves her response; the player does not directly control her.

The canonical cast is Dilan (33, revision 2), Aylin (36), Ece (24) and Murat (27). Canonical profiles come from the released lab client. Private discoveries require actual choices.

## Saves, recording and lab tools

The current week is saved in this origin’s browser local storage. A save contains its edition, seed, input log and state. Resume validates the run. Failed admission or loading preserves the saved week. Browser storage and exported files are distinct; loading a file does not grant ownership of a shared continuation.

The first-visit notice explains recording and linked play across games on this device. One menu recording switch controls both. Explicitly turning it on opts in despite DNT/GPC. Character analysis has its own opt-in. With recording off, feedback offers an unticked choice to share this play; leaving it unticked sends the note without the saved run or linked history. See [Lab privacy](https://human.adamwhite.work/lab/privacy/).

Current source Feedback offers **I'm stopping** and **I'm confused**. Selecting or
clearing one sends nothing and leaves your edited note unchanged. **Submit** combines
the selected words, optional verdict and current note. This is source behavior; its
CI repair and live-delivery status are recorded in HANDOFF.

Gameplay is public. Other ways to begin offers a week-two start. The title offers the three-week and outcomes editions. The menu offers pace, New game and Download this run. Slow changes gaps between choices, not the 64-second choice window. Debug starts collapsed beside Lab privacy and contains seed, provenance, run loading and replay verification. Cross-game people carry over automatically through the central shelf; cast controls live there. Downloaded runs preserve pinned inputs. Loading validates exact replay and never claims the latest shared heads.

## Supported continuation routes

Fresh play prepares applicable people together and admits the whole cast atomically. Unsupported, old or closed source heads refuse the start. Inspect and manage those people on the central shelf. Parent conflicts require an explicit alternate branch for the selected person. Local source archives and exact replayed notebooks are required for native returns; an imported file retains file origin through reload.

| Receiving route in this source | Engine admission                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Murmur’s own canonical chapter | Retained 2.17.0/2.21.0 and current 2.23.0                                             |
| Neighbours Ece (`noor`)        | Exact `neighbours-cast-1` / `neighbours-cast/1`; retained engines and current 2.23.0  |
| Hearsay Dilan                  | Exact `hearsay-cast-6` / `hearsay-cast/1`; retained engines and current 2.23.0        |
| Good Hands Aylin               | Exact `goodhands-6` / `goodhands-agency/1`; retained 2.17.0/2.21.0 and literal 2.23.0 |

These are finite adapters, not general compatibility promises. Good Hands Aylin requires `goodhands-6`, `goodhands-agency/1`, `goodhands-agency-calendar/1` and role `aylin`. Its proven foreign engine is literal `2.23.0`; Murmur’s own current engine uses `ENGINE_VERSION`. This does not admit every 2.23 source or another role. Identity, checkpoint, norm, skill, body, calendar, duty and provenance checks still apply. A Saturday departure can pause supported unfinished plans through an explicit replayed choice; pausing does not complete them. The ending offers a Hearsay visit.

The unchanged artifact from signed Good Hands source `509386298dfd89026c10bc6011d4f29e3323fb0c` has independent full-notebook, raw-state, RNG, checkpoint and production-builder replay proof. Retained claims, complete receiving replay, owned native re-entry and missing-notebook refusal have in-memory controls. These do not prove shared-server ownership, a human cross-host journey or a round trip.

## Development and delivery

Use shared Node 26.12.0 (`.node-version` and `.nvmrc`) and pnpm 12.14.0 with `/opt/homebrew/bin` first on PATH. Install with `pnpm install --frozen-lockfile`; run `npm run dev`. This host pins game edition 0.6.0, HF package 3.0.0 (Person engine 2.23.0), lab client 0.4.11 and lab kit 0.5.12. TypeScript 7 or later is required; this checkout pins 7.0.2. SDK archives remain immutable release artifacts.

Before each commit, run the normal lane under the shared lock:

```sh
node ~/code/human-framework/scripts/suite-lock.ts -- npm run check:lane
```

App deployment uses the same wrapper around `npm run deploy`. Deploy only clean signed exact main with exact green CI. Verify the resulting live `/release.json`. Source-only docs need no deployment. See [AGENTS](AGENTS.md) for delivery rules and [HANDOFF](HANDOFF.md) for the current receipt, browser limits and remaining owner acceptance. [Design](docs/design.md) records design history; it is not a current delivery receipt. Follow the [plain-English rules](docs/lab/plain-english.md).

Dependency changes use pnpm and the committed `pnpm-lock.yaml`. The npm lock was imported with exact dependency versions preserved. Do not regenerate an npm lock or install a runtime per worktree. The policy uses strict engines/peers, no hoisting, hardlinks, a 24-hour third-party release delay and an owned `@adam0white/*` exemption.
