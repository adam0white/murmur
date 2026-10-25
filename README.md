# Murmur: Two Voices

[Play Two Voices](https://murmur.adamwhite.work/). You suggest what Dilan should do during an ordinary week. She can agree, refuse or choose another action. Her other inner voice offers its own advice.

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

The exact `?lab=1` query enables lab tools: run loading, downloading, seed controls, chapter/history/passport controls and pace settings. Slow changes gaps between choices, not the 64-second choice window. Downloaded runs preserve pinned admitted inputs for deterministic replay. Current exports require exact replay validation; incompatible older files may refuse with a start-fresh message. Loading never claims the latest shared heads.

## Supported continuation routes

Fresh play prepares applicable people together and admits the whole cast atomically. Unsupported, old or closed source heads refuse the start and offer fresh local play. Parent conflicts require an explicit alternate branch for the selected person. Local source archives and exact replayed notebooks are required for native returns; an imported file retains file origin through reload.

| Receiving route in this source | Engine admission                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Murmur’s own canonical chapter | Retained 2.17.0/2.21.0 and current 2.23.0                                            |
| Neighbours Ece (`noor`)        | Exact `neighbours-cast-1` / `neighbours-cast/1`; retained engines and current 2.23.0 |
| Hearsay Dilan                  | Exact `hearsay-cast-6` / `hearsay-cast/1`; retained engines and current 2.23.0       |
| Good Hands Aylin               | Exact `goodhands-6` / `goodhands-agency/1`; retained 2.17.0/2.21.0 only              |

These are finite adapters, not general compatibility promises. Identity, calendar, duties, checkpoint and provenance checks still apply. Current Good Hands 2.23 receiving is an unshipped V3 follow-up. A Saturday departure can pause supported unfinished plans through an explicit replayed choice; pausing does not complete them. The ending offers a Hearsay visit. Fixture admission and generated source replay do not prove an ordinary played cross-host ownership journey.

## Development and delivery

Use Node 24 or later with `/opt/homebrew/bin` first on PATH. Install with `npm ci`; run `npm run dev`. This host pins game edition 0.6.0, HF package 3.0.0 (Person engine 2.23.0), lab client 0.4.10 and lab kit 0.5.11. TypeScript 7 or later is required; this checkout pins 7.0.2. SDK archives remain immutable release artifacts.

Before each commit, run the normal lane under the shared lock:

```sh
node ~/code/human-framework/scripts/suite-lock.ts -- npm run check:lane
```

App deployment uses the same wrapper around `npm run deploy`. Deploy only clean signed exact main with exact green CI. Verify the resulting live `/release.json`. Source-only docs need no deployment. See [AGENTS](AGENTS.md) for delivery rules and [HANDOFF](HANDOFF.md) for the current receipt, browser limits and remaining owner acceptance. [Design](docs/design.md) records design history; it is not a current delivery receipt. Follow the [plain-English rules](docs/lab/plain-english.md).
