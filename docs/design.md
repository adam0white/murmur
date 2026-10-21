# The Two Voices: design

**One line.** You are the inner voice of Dilan, 33, a dispatcher at a courier depot in the town she moved back to eight months ago. Her own pull speaks at the same moments, louder. You can only nudge. Each night she looks back over the day in her own words. Nothing is graded until then.

**Done for the first playable** (set 2026-10-19 by the coordinator's brief; the owner accepts feel separately): five played weekdays and a Saturday morning, an ending, a playtest export that replays, tests, a headless measure, at least three source-unread playtests recorded verbatim with their findings applied, live at https://murmur.adamwhite.work and listed in the HF games collection.

## How it was chosen (2026-10-19)

The brief (concept 2 of `human-framework/docs/game-taste-2026-10-19.md`) went with three candidate loops to two consultants who read no source.

- **Game-design expert (Opus):** loop A (moment cards on a running day) as the spine, with C's evening as a scene you take part in. "B: timing inside one moment turns into watching a bar build … C: you plant advice, then watch the day play out fast. That is the silent, low-agency expedition he rejected." The pull writes in pencil, you in ink; its strength is the size of its writing, not a meter; "some of [its wins] should be right … The game breaks if the player's rule becomes 'always oppose the pencil.'" Five weekdays and a Saturday page. Biggest risk: the player becomes a nag, and she says no to a nag. Wild idea: on Thursday, if she trusts you, the pull starts writing in your ink.
- **Wildcard (Sonnet; Leyla, an ER triage nurse and former stand-up who plays on the night bus):** the same hybrid. "Silence has to be a legit move that gets me information, or it's just waiting." Each day adds a new kind of choice, not more difficulty; "Wednesday the loud voice starts agreeing with you, which is the scariest thing." Phone-down list: a tutorial popup, words like "journey" or "mindfulness", any meter, waiting on a timer, an obviously Good option, a first card over two lines, streaks, preachiness in either voice, a sad tone ("make me laugh once in the first minute"). Wild idea: the week ends as her voice note to Mum, written from her review lines; sending it is her call.

Taken: A + the evening scene, five weekdays + Saturday, pencil vs ink, size of hand instead of meters, a pull that is sometimes right, the borrowed ink (Thursday on), the voice note ending, the shelf and the cropped photo. Not taken: a cap of three insists a day (an arbitrary cap; AGENTS.md wants limits from capabilities). Trust is the limit: insisting works, and it costs.

## The core loop

1. **The day runs.** The clock moves from 06:40 to bed. Between moments Dilan lives through HF (commute, work, meals) and the journal writes a line. A day is about three minutes.
2. **A moment arrives** (8 a day): one line of scene, her pull in pencil, and 2 or 3 things she could do, in your ink. Time slows while the card is open (no pause).
3. **You choose:** tap an option to say it, press and hold to insist, or say nothing. If the card's few minutes pass, she decides with only the pull in her ear.
4. **She decides** (HF `decide` with both voices: `you` and `pull`, each with its own trust). She answers in her own words: yes, fine-if-you-insist, after this, something like it, or no, with a reason. The pull can win.
5. **Evening.** The last card is in bed: write it down, scroll, or sleep. Writing makes tonight's review an accounting (HF review style `accounting`); otherwise she goes over it (`ruminating`, her default: weaker resolves, a little distress).
6. **The review page.** Her review line (HF `reviewLine`), what she kept and missed, one line about you, any new phrase of her own in the margin, and tomorrow's resolves as underlines.
7. **Tomorrow** carries it: a resolve prints on its card in her hand and pulls in HF (`review:resolve`); lost sleep makes the pull louder in the morning; a lie or a word at lunch comes back.

### After the first playtests (2026-10-19, see docs/playtests/)
Four source-unread testers and the HF-character harness agreed on these. They changed the rules:
- **Holding is a capability, not a free override.** It carries only while she trusts you enough (`INSIST_FROM`, 0.45). Each hold costs trust. Below that line a hold carries less than a tap, and she says so: "You keep pushing me. I'm not listening to that today." Always holding now loses more moments than plain speaking.
- **Her phrases fade unless you say them again.** Each night a phrase you did not say again that day loses a fifth of its practice. This is host-side, because HF's 60-day half-life is too slow for one week (HF request 5). Training and then coasting no longer works. She still turns the pull away on her own sometimes.
- **The hints are honest (edition 0.2.1).** Her will runs at temperature 0, so the mood words on each option ("she's willing", "only with a push") are what HF predicts she will do. Runs differ through the seed's small differences in her habits.
- **Honesty and kindness are not free.** Her convictions against lying and backbiting are lower, so the pull wins at those too. The first lie at the depot works ("Nobody checked."). The second time she owns up to being late, Murat writes it down in pen.
- **Threads close.** Ece's "after six" becomes a Thursday scene. Saturday closes Ece, Murat, the shelf and the lock-screen photo in a line each.
- **Repeats vary.** The coffee, bus and bed cards have a different line each day. The journal keeps each card's scene and pull line, so a card that closed while the player was away still reads.
- **Bodily lines.** Routine hours now give water (tea at the desk), so she no longer reaches dinner "too thirsty". The forecast speaks only when an exertion would really cost her.

### After the first-timer playtest (2026-10-19, Claude Haiku)
A first-timer could not tell her replies from the pencil, read the mood words as odds, and saw "Later" quietly hand the moment to the pencil. Fixes, none of which change a decision:
- **Three hands, three looks.** Your ink is the serif; the pencil is graphite blue-grey handwriting; her replies are quoted handwriting marked "she says".
- **Mood, not odds.** The small words are her mood: she's willing, she'd grumble, only with a push, she'd put it off, she's against it.
- **Say when she didn't.** When she does not do what you said, a line says so before the narrator line: "She put yours off, so the pencil's way, for now." or "She didn't. She went the pencil's way."
- **Every refusal has a reason.** When HF gives her no words, the host gives her a true one: tiredness, the easier way, or a plain no.

### Edges we keep (owner, 2026-10-19)
The owner wants the edges playtesters find "a bit fun and slightly in our calculations" kept, not closed. The measure's `edge` policy plays them: it sides with the pull where the pull is right (the coffee when she is tired, the first lie), holds only where a hold carries and beats a tap, and speaks on borrowed cards. Over 8 seeds it lets the pull win 1.9 of 18.6 prompts and keeps 9.8 commitments, against 4.3 and 8.8 for the honest reader. It is the best policy but not a rout, so the edges stay.

### What saying nothing does
It is a real move. You see who she is without you. A turning-away she learned from you (below) only shows as hers when she uses it unprompted, and the evening notes it: "I did that one myself." Saying nothing costs no trust and lets voice pressure fade. It does let her phrases fade. A "say nothing" control on each card makes silence a visible move.

### Two voices, made concrete
- `pull` is an HF voice with its own trust (starts higher than yours: it has been with her longer). Its suggestion goes into the same decision as yours. When giving in felt good, she trusts it more (HF `learnFromVoice`). Its handwriting grows and shrinks with that trust.
- Your ink darkens or fades with her trust in you. No meter for either.
- The pull is sometimes right: the coffee before the 15:00 rush, skipping the run when she is spent. Those moments carry no held norm against the pull.
- **Promptings:** tempting options carry a `temptation` tag and a norm from the HF catalog (punctuality, lying, backbiting, kindness-to-parents). HF records each as a prompt that passed, turned or won.
- **Turning away:** when she follows you away from a prompt, she keeps your words as her own phrase (an HF prompting response, `redirect` or `leave`, low practice). Practice grows whenever it holds and fades with disuse. On later days the margin shows her phrases; by Friday she may turn before you speak.
- **Borrowed ink** (Thursday and Friday, when she trusts you more than the pull): some pull lines arrive in your ink with a slightly wrong slant ("You said rest matters."). Mechanically the pull's suggestion then comes under your voice id, so her trust in *you* pays for it if it goes badly. Saying something real on that card drowns it out. The evening may notice: "Some of what I heard today wasn't you."

### Progressive disclosure, one new kind of choice a day
- **Monday:** tap to suggest, hold to insist, or say nothing. The first alarm offers a hold with its trust cost beside the suggestion; holding fills the ink and acknowledges insistence. The pull, the lie at the depot (only if she was late), the gossip at lunch, Mum.
- **Tuesday:** Monday's resolve prints on its card.
- **Wednesday:** bodily forecast: Murat asks her to cover Ece's evening route, the night of Aylin's birthday dinner ("I can do the route, but I'll be spent for Aylin's."). Mum's message if she missed two calls.
- **Thursday:** borrowed ink. The shelf.
- **Friday:** the gym renewal ("We miss you! Your plan renews Friday"). The week's last bus home.
- **Saturday morning:** the voice note to Mum, made from her review lines. Sending it is her decision; you can whisper. Then the last page.

### Achievement, without a scoreboard
- A good week: on Thursday or Friday she turns before you speak; her phrases fill the margin; the call to Mum happens; the last page is short and plain.
- A hard week: pressed handwriting, crossings-out, many weak resolves; still one honest line she means.
- The last page: her own phrases, what she now does unasked, the two hands side by side, and the week strip.

## The back story (implied, never told)
Dilan moved back to her hometown eight months ago after something ended. Objects that imply it: her lock screen is a beach photo with one person cropped out; a half-built shelf in the corner with the screws still in the bag; the gym email; her sister Aylin's voice notes ("Mum's asking again. Just ring her, it's ten minutes."). Murat runs the depot floor. Ece is the new driver.

## HF use (pinned exactly: 2.7.0 at start, 2.8.0 since 2026-10-19)
One `Person` (Dilan). Voices `you` and `pull`. Opt-ins: fatigue store, promptings (reading `inclination`, never shown), review (style `ruminating`, 22:00). Commitments via `promise`: her alarm (to herself, daily), calling Mum (to Mum, evening window, daily), Aylin's dinner (Wednesday). Norms from the HF catalog only; no invented rulings. `predict` gives each option a faint lean (pure). `bodyForecast` on offers with `followedBy`.

## Rules
- Inputs are stamped with the sim minute; replay of seed + input log rebuilds the state exactly.
- No meters or percentages for Dilan's inner state. Money is not in this game; the clock is.
- Faith stays quiet and unnamed. The prompting reading is never shown.
- Short lines, at most two lines of scene per card. One laugh in the first minute.

## Clarity follow-up (2026-10-20, F-229)

The delivery artifact for this round is the implementation report at `human-framework/scratch/followups/murmur-report.md`, with tests, rendered phone/desktop evidence, a signed commit and a matching clean live release. The Opus driver accepts the follow-up; the owner accepts feel separately.

- **DL-15:** one line beside the running day reports the current simulation minutes per real second and why it is slow (a waiting choice or reading her reply). The existing playback rates, minute steps, decisions and exports stay unchanged. The game menu keeps the clock running.
- **DL-26:** the menu button's accessible name and panel title are “Game menu”. Local export is “Download this run” in both menu and ending; the collection link is “All games”.
- **DL-4/DL-5:** a declined suggestion keeps her original reply and adds a possible response in her words. A pure reconstruction of that exact decision forecasts whether insisting could have carried. If so, she names pressing and holding a future suggestion. If pushing no longer carries, she asks for a plain word or silence. Otherwise she can name an alternative she was willing to hear. Every line makes clear that the resolved moment stays resolved; agreement is never promised.
- **Verification:** deterministic refusal tests, a pre-change 0.2.1 full-state replay/continuation hash fixture generated from commit `60e926d`, browser rate/menu/download tests, and touch-emulated 360×690 plus 1280×800 renders. Long refusal plus completed narration fits; the response control keeps its position when narration arrives. No simulation or HF dependency change.
- **Acceptance limit:** this is builder verification. Leyla's willingness to return needs another source-unread playtest; this round does not claim to establish it.

## Round 4 (2026-10-20, Farah retest)

What remains: Opus driver acceptance and a fresh source-unread retest of whether early insistence and distinct refusals sustain engagement. The delivery artifact is the appended Round 4 section of `human-framework/scratch/followups/murmur-report.md`, with tests, touch phone/desktop renders, a signed commit and a matching clean live release. The owner accepts feel separately.

- The first alarm exposes the real hold gesture beside a suggestion whose forecast improves when insisted. The player can hold it immediately, see ink fill and “insisting…”, and hear the existing simulation response. A plain tap and silence remain available. Its trust cost appears before acting. Cues no longer conceal a useful hold until Tuesday.
- Refusal recovery uses the exact pre-decision state. Monday's alarm, Aylin, Murat, Ece, lunch and Mum responses differ in her words and describe possible future changes. Tiredness, lateness, lost trust and willing alternatives determine the response. A resolved moment stays resolved.
- Each resolved moment keeps “You suggested” beside “She chose” in the journal. Explicit silence and timeout are distinguished. The same reconstructed labels appear below the current reply after import; conditional wording comes from the original moment. Narration appears only when the simulation clock reaches completion.
- Simulation, input schema, playback policy, framework pin and old exports stay unchanged. Exact legacy replay and continuation remain acceptance checks.

## Design change 2026-10-20 (owner may veto)

New runs start on edition **0.3.0**. Farah (F-245): “this sequence of taps felt too much like watching her follow the other voice.” Lina (F-253): “I wanted influence through suggestions, and I had not felt that influence yet.” Her request: “Let a gentle suggestion produce a noticeable response early, even when she refuses.”

A plain suggestion can now carry against her leaning. HF draws from its own scores with temperature 0.14 and the RNG in her state. Trust raises the suggestion's score; pressure lowers it; a smaller score gap makes listening likelier. HF still vetoes real incapacity and held convictions. Holds retain deterministic resolution, capability limits and trust costs. Her starting bed and phone habits are slightly less settled, making Monday's first choices close calls. No opening win is scripted.

A gentle refusal can remain as HF standing advice when she was listening, trusts the voice, and has not been pressed too far. HF owns its decay, score and discharge; repeated advice refreshes one entry rather than stacking. She acknowledges the thought immediately. Its next related card, reply and journal can name it; the evening can remember the original refusal. The trace records retained advice, not a promise to comply. A live repetition replaces that source's remembered term, as HF already specifies.

**The hints are honest in this edition:** “she leans toward it, but hasn't decided” means probability at least one half; “she's against it, but she's listening” means one tenth to below one half; “she's firmly against it; a small chance she'll listen” means above zero to below one tenth. “She can't” / “she won't” only appear for zero chance; “she's willing” only for certainty. These bands are builder checks, never shown as feeling numbers. The new forecast reads the actual input minute without changing state or RNG. The card shows remaining real response seconds. A release belongs to the exact card and control pressed; an expired or replaced card receives no input from it.

Cost and risk: more uncertainty makes her less predictable. Retained words add reading. Some suggestions are forgotten or have no related moment before Saturday. The same eight-seed measurement compares both editions and includes silence, opposition, holds, pull, reader and edge policies; it is evidence about those policies, not owner acceptance of feel. No requested part of this change is deferred. The lead designer keeps final taste review and owner acceptance.

**Replay and revert:** 0.2.1 saves and exports stay on 0.2.1, including unversioned historical saves. Creation and replay take an explicit edition; stored metadata and journal reconstruction preserve it. Canonical full-state hashes were captured from commit `a9447c2` before simulation edits: 12 complete runs across three seeds and four policies, plus 36 checkpoint replays/restored continuations. New runs use `GAME_VERSION` in `src/sim/game.ts`. To revert the default, set it to `'0.2.1'` and deploy. Keep `LISTENING_EDITION` and both supported branches so existing 0.3.0 runs still replay.

## Deferred (target: 2026-11-03)
- Replace Friday’s repeated coffee card (fun review 2; target 2026-11-03): a new competing obligation changes the decisions and needs its own authored situation, edition boundary and playtest; this round preserves live 0.3.0 runs.
- More campaigns, including a second week.
- Other people as HF persons (Ece, Mum).
- DL-27 exact resume and saved-location sentence (review finding 1; target 2026-11-03): versioned snapshots, legacy migration and reload tests need a separate persistence change; current seed/input-only Continue can skip an unanswered interval.
- DL-28 replay-preserving send compaction (review finding 4; target 2026-11-03): both send paths need a compact export contract with exact in-progress replay boundaries and representative upload-bound tests.

### Follow-up b (2026-10-20; owner may veto)

What remains: lead designer acceptance and a fresh source-unread check of feel. The delivery artifact is the `Follow-up b` section of `human-framework/scratch/design-round/murmur-report.md`; the lead designer accepts the round and the owner accepts feel.

Priya's fresh retest: “I thought on with the day meant the day was waiting for me” and “Still thinking about it is now the same reassurance twice.” Her result was a keep: “I would return voluntarily for a short session.” These fresh reports have no new ledger IDs; the earlier request remains F-245/F-253. The fun review also saw the same alarm recall on Tuesday and Wednesday and a final hold that the ending did not acknowledge.

The existing live-card replacement and slowdown are now covered by normal-playback browser tests at both fixture sizes. We could not reproduce a hidden next card on 052ad26: twelve seed/answer probes, including assent and refusal, all showed it. The reply control now says “Let time pass faster”; beside it, “The clock keeps running.” It describes acceleration rather than a waiting transition.

Retained words use action-specific acknowledgments. Their first related card can recall them once; that answer reports the new result rather than repeating the recall. A completed action gets past-tense acknowledgment only when its narration is due. Later related cards and bedtime leave that thought alone. The journal preserves the exchange. One actual learned phrase appears quietly beneath the clock during the day. Saturday distinguishes a suggestion, an insistence she followed, an insistence she refused, explicit silence and timeout using the final moment's own record.

All changes are presentation-only. Edition **0.3.0** and the HF **2.8.0** pin stay exact. Before editing, we captured 12 final canonical full-state hashes plus 36 checkpoints and restored continuations from 052ad26, alongside the existing 0.2.1 fixtures. Retiring a displayed thought does not discharge or change HF advice. It can still influence later choices while HF retains it; the UI stops repeating it.

Cost: a single quiet phrase does not show every word she has learned. The player's earlier exchange remains in the journal, so a sentence can persist as history after leaving the reply; it is not announced again as a new recall. Reversal: revert this follow-up's UI changes and tests; keep both replay fixtures. No new-run edition switch is needed.

## The second week (edition 0.4.0, 2026-10-20; owner may veto)

What remains: owner acceptance of feel. The Protocol 2 retest ran on 2026-10-20 (human-framework `docs/lab/reviews/murmur-week2-2026-10-20/`, ledger F-367 to F-377). The delivery artifact is a deployed 0.4.0 whose Saturday page offers a second week; the lead designer accepts the slice, the owner accepts feel.

Owner, 2026-10-20: "We both need more of the same as well as other campaigns." "I am her. I want to keep pushing her to do better." The lab's named trap: "more weeks whose state persists while the decisions repeat." A Codex wildcard pass proposed the theme; an adversarial review (Claude, contrarian narrative designer) cut and reshaped it. Both texts: `~/code/.lab-scratch/murmur-more/` (local).

**Theme: getting better causes trouble.** Last week Dilan got a little more dependable. This week somebody starts depending on her. Ece's title for it: "Leave it with me."

- **The same person goes on.** After Saturday's last page, "Another week" (now the main button; "Start over", a new run, is the quiet one) continues the same run: her trust in both voices, her phrases and their practice, habits, tiredness, and every open thread. Finished 0.3.0 runs can continue too: week one under 0.4.0 is rule-for-rule and line-for-line 0.3.0, so the old inputs replay as 0.4.0 and go on. The 0.3.0 export itself still replays as 0.3.0.
- **Week one's last page is canon.** Its thread lines and closing line ("On Sunday she rang anyway", "Ece has her own columns now", "Aylin came round on Saturday for the shelf", the lock screen) are true in week two. Nothing in week two contradicts them.
- **More of the same, at the same density.** Five or six cards a day: the alarm, the bus home (the call to Mum), bed, and three new situations. Habits she built show as lines she does unasked. While "Feet on the floor" is strong she gets up alone and the journal says so.
- **One new kind of choice a day:**
  - Monday, *accept help*: Ece offers to clear the returns. Let her, or redo them herself. Mum's answer to Saturday opens the day; a tenancy renewal letter arrives and is never explained.
  - Tuesday, *your words in her mouth*: Ece asks Dilan how to handle something, and Dilan answers with a phrase she learned from you. It may be wrong for Ece. Let it stand, soften it, or tell her to ask Ece what she thinks. Ece also asks for practice on the board: Dilan promises twenty minutes, Thursday evening, or nothing (an HF promise to Ece).
  - Wednesday, *correct your own advice*: the pull quotes her own learned phrase, bent ("Just say it plainly. In front of everyone."). Then Ece makes a mistake: correct her privately or across the room. The evening is family.
  - Thursday, *let another method stand*: Ece runs the board her own way. It works, and Dilan can't read it. Leave it, change it together, or put it back. Any promise to Ece falls due on the same evening as Dilan's own thread.
  - Friday, *take back a promise*: she wants the early bus, and something is in her bag. Ece asks her to stay. Stay, withdraw a promise openly (HF `release`), or slip out.
  - Saturday: Ece's message about the week, then the last page with both weeks.
- **Kept unresolved for good:** who was cropped out of the photo, what ended, the subscription, the tenancy letter, what is in her bag on Friday.
- **The edge we keep:** leaving can be selfish and still work. Staying can help Ece and cost Dilan something she won't explain. Kindness gets no guaranteed reward. The week-two pull is harder, because it uses her own phrases.

Cut after review: a Sunday "aim for the week" (it read as a quest log with a pass/fail stamp), and a Tuesday double booking that repeated Wednesday of week one. HF pin stays 2.8.0 (`promise`, `release` and promptings cover the slice).

**Replay and revert:** 0.2.1 and 0.3.0 saves stay on their editions and end on Saturday as before. New runs use `GAME_VERSION` 0.4.0. To revert the default, set it to `'0.3.0'` and deploy; keep the 0.4.0 branch so existing week-two runs replay.

Deferred (target 2026-11-03): another person's week (Aylin); replay-variety Tuesdays; a Sunday aim, if Saturday of week two feels aimless; Ece and Mum as HF persons.

### What is new in 0.4.0, as built (2026-10-20)

- **Another week** on Saturday continues the same Dilan into Monday (day 8). Sunday passes offstage: two nights of fading phrases, and her daily promises (alarm, call to Mum) renew.
- **Begin at the second week**, on the cover, for players who already know week one: a quiet voice plays week one for you (her likeliest answer each time, never the pull), and you start on Monday of the second week. (The first build showed week one's Saturday page first, with "You suggested" lines the player never said; the first retest caught it, fixed the same day.)
- **Getting up alone.** When "Feet on the floor" has enough practice (0.45), she skips the alarm card and gets up by herself, and the journal says so. Measured over 8 seeds: about 4 of 5 mornings for players who argued for it, none for players who stayed silent.
- **Your advice travels.** What you told Dilan in week one comes back in Ece's mouth. "Walk away from it" and "Feet on the floor" fit Dilan and fit Ece badly; Thursday shows the result.
- **The pull has listened too.** In week two it is a little louder (+0.1) and quotes her own phrases back bent.
- **Friday** can release a promise openly (HF `releaseCommitment`); the early bus really is earlier.
- **The last page** shows both weeks side by side, and the two-hands line reaches back a fortnight.

**Honest difficulty note.** Week two's pull is only a little louder. Engaged players still win most prompts (8 seeds, week two only: an insisting player lets the pull win 0 of 7 prompts; a reader 1 of 10.5; a silent player 8.4 of 13.3; a pull-follower 11.1 of 14.5). Week two's difficulty is in trade-offs, not in the pull: helping Ece costs Dilan's evenings and her own promises, and advice that worked for her goes wrong for someone else. Not tuned further on purpose; if the owner wants it harder, the pull bonus is one constant (`WEEK_TWO_PULL`).

**Retest, 2026-10-20 (Protocol 2, phone).** Every valid tester's best moment was the same: Dilan handing Ece the advice the player gave her ("Feet on the floor. Drive it round yourself."). The worst was the routine cards (alarm, bus call, bedtime), which repeat each day with the same answers; two of three first wishes to leave came there (4:09 free, 10:55 floor; a third tester stopped satisfied at 3:03 and would return). Fixed the same day: the cover shortcut now opens Monday of the second week, and week-two labels speak in Dilan's first person.

Deferred from the retest (target 2026-11-03): week-two routine cards offer a different answer or turn on most nights; "say nothing" stays above 690 px on three-answer cards; plain words for "the pencil's way" after a refusal. The routines are "more of the same" by design, so whether to vary them is the owner's call.

### Week-two routine variation (0.4.1, 2026-10-21)

Owner direction resolves the routine-card deferral above: vary two routines and keep one steady. The bus call and bedtime now offer different wording on each weekday, tied to that day's photograph, missed call, family evening, board, or Friday bag. The alarm keeps “Feet on the floor” and “Five more” as the steady habit; learned independent waking still applies. Actions, consequences, timing, HF 2.8.0, and background faith stay as before.

New runs, including the second-week shortcut, use 0.4.1. Existing 0.4.0 exports replay and continue with their original words; 0.2.1 and 0.3.0 replay unchanged. Finished 0.3.0 runs can continue into 0.4.1. Delivery ends with a signed commit on main, green CI, a deployment whose release metadata matches that clean commit, and the requested scratch report. Owner acceptance of feel remains outstanding.

## Other-voice typography audit — F-404 (2026-10-21)

Owner direction, verbatim and in order:

1. 'I think it would be clearer if the handwritten font in the two voices is only for the other voice, or descriptions about it. We can be consistent about this and that would reduce the cognitive load'
2. 'Or the slightly diagonal style of handwritten font. We just need to adapt a consistency'
3. SOFTENED: 'I must say that handwritten is growing on me and the color and slanted style is almost consistent, so I'm softening my direction. We still need to check and stay consistent to make things easier though, so the investigation is afoot'

The resulting rule keeps Caveat, the existing blue-grey pencil colours, and the slight rotation together on the other voice and text about it. `.other-voice` owns all three. Its default angle is −2°; trust-dependent pull and comparison angles remain −1.2° to −2.8° through `--other-voice-angle`. Dilan, the player, narration, headings and controls use Literata upright. Spacing, practice opacity, trust-dependent player ink, and existing type sizes remain except for the fit corrections below. The other-voice caption uses 17px so the handwritten face remains legible.

This supersedes the older “three hands” presentation and the visual disguise in “borrowed ink” above. Borrowed lines still use their authored words and the same HF voice attribution, trust, decisions and replay edition; they now identify their source visually. This is the owner's explicit consistent-marker rule, not a change to the simulation.

The audit covers all renderer branches in `src/ui/app.ts`, every font, colour and slant rule in `src/ui/style.css`, and text/font references in `src`, `index.html`, and `public`. Repeated runtime instances count once per renderer place below; the two pencil refusal descriptions share one place. **40 live style inconsistencies found; 40 fixed.** Dormant declarations and shared infrastructure are listed separately and excluded from that count.

| Place | Current style before audit | Verdict | Change |
| --- | --- | --- | --- |
| Cover, “The other got there first.” (`title`) | Caveat, ink-soft override, −2° | Fix | Keep face/slant; restore pencil colour. |
| Ordinary pull card (`cardHtml`) | Caveat, pencil, trust-sized/rotated | Keep | Route unchanged values through `.other-voice`. |
| Borrowed pull card (`cardHtml`) | Literata, your ink, skew −9° / rotation +0.4° | Fix | Use the same other-voice marker and trust sizing as other pull lines. |
| Journal pull (`drawJournal`, who=pull) | Caveat, pencil, upright | Fix | Add shared slant. |
| First-card explanation, “the pencil is the other voice” | Literata italic, ink-soft | Fix | Add shared marker; 17px keeps Caveat legible. |
| Refusal/defer descriptions naming the pencil (`recordHtml`) | Literata italic, pencil | Fix | Add handwritten face and shared slant. |
| “She didn’t. She did something else.” (`recordHtml`) | Literata italic, pencil | Fix | Plain ink and upright; it does not identify the pull. |
| Saturday “the pencil” comparisons (`handsHtml`) | Caveat, ink-soft override, trust-sized/rotated | Fix | Restore pencil colour; preserve size and angle. |
| Evening “Some of what I heard today wasn’t you.” (`pageHtml`) | Caveat, ink, upright | Fix | Apply complete marker to this borrowed-voice description only. |
| Header weekday (`header`) | Caveat, ink-soft | Fix | Literata; preserve size/line height. |
| Kept words beneath clock (`header`) | Caveat, ink-soft | Fix | Literata; these are her learned words. |
| Journal heading (`drawJournal`) | Caveat, ink-soft | Fix | Literata; preserve size. |
| Journal Dilan speech (`drawJournal`, who=dilan) | Caveat, ink | Fix | Literata; preserve size. |
| Recorded reply and “she says” (`recordHtml`) | Caveat reply, Literata attribution | Fix | Literata reply; keep attribution. |
| Recorded learned phrase (`recordHtml`, margin) | Caveat, ink | Fix | Literata; preserve size. |
| Card resolve (`cardHtml`) | Caveat, ink | Fix | Literata; preserve size and tally. |
| Card bodily forecast (`cardHtml`) | Caveat, ink-soft | Fix | Literata; preserve size. |
| Option mood (`cardHtml`, lean) | Caveat, ink-soft | Fix | Literata at 14px so the wider serif mood labels retain the phone-card fit. |
| Card recalled thought (`cardHtml`, stayed) | Caveat, ink | Fix | Literata at 17px to preserve phone-card fit. |
| Reported retained/completed thought (`thoughtHtml`) | Caveat, ink | Fix | Literata at the same 17px as card thoughts. |
| “say nothing” control (`.hush`) | Caveat, ink-soft | Fix | Inherit Literata; preserve control dimensions. |
| Evening resolve (`pageHtml`) | Caveat, ink | Fix | Literata; preserve size and tally. |
| Evening learned phrases (`pageHtml`) | Caveat, ink, −1.5° | Fix | Literata upright; preserve practice opacity and size. |
| Evening independent-action speech (`pageHtml`, alone) | Caveat, ink | Fix | Literata; preserve size. |
| Evening heading (`pageHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Evening review (`pageHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Evening herLine (`pageHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Evening aboutYou, all other branches (`pageHtml`) | Caveat, ink | Fix | Literata; preserve size. These describe you, not the pull. |
| Continuation notice (`ending`) | Caveat, ink-soft | Fix | Literata; preserve size. |
| Week-strip weekday labels (`stripHtml`, both weeks) | Caveat, ink | Fix | Literata; preserve size. |
| Final learned phrases (`finalHtml`) | Caveat, ink, −1.5° | Fix | Literata upright; preserve practice opacity and size. |
| Final independent actions (`finalHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Saturday heading (`finalHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Final input reflection (`finalHtml`) | Caveat, ink | Fix | Literata; preserve size. |
| Toast (`.toast`) | Literata italic, sky | Fix | Upright; preserve sky status colour. |
| Journal scene (`.jscene`) | Literata italic, ink-soft | Fix | Upright; preserve colour. |
| Other captions: timer, mood explanation, running clock (`.caption`) | Literata italic, ink-soft | Fix | Upright; preserve size and colour. |
| Gameplay hints (`.hint`) | Literata italic, ink-soft | Fix | Upright; preserve size and colour. |
| Your recorded input/silence (`.record-yours`) | Literata italic, ink | Fix | Upright. |
| Chosen action (`.record-chosen`) | Literata, pencil | Fix | Normal ink; a chosen action is not a pull utterance. |
| Voice note to Mum (`.voicenote .note`) | Literata italic, ink | Fix | Upright; Dilan is speaking. |
| Dormant `.herchoice` and `.yousaid .ink` rules | Pencil colour / italic; no rendered uses | Remove dormant rules | Remove marker declarations; not counted as live inconsistencies. |
| Shared typography infrastructure | `.hand` applies Caveat plus size/line-height | Consolidate | Rename size/line-height helper `.notebook-text`; only `.other-voice` owns face, colour, rotation. |
| Theme tokens / Google font loading | Caveat plus light #5f6b78 / dark #9fb0c2 | Keep | Keep original assets and theme colours. No other text rule consumes hand or pencil. |
| SVG tick rotation / wobbled rules and tally strokes | Rotated tick geometry; ink-soft/moss strokes | Keep | Non-text geometry does not mark a voice. |
| Other-voice metadata in index.html description | Nonvisual plain metadata | Keep | No rendered text to mark. |

### Screenshot comparison and acceptance evidence

Playwright comparisons use the same seed (42), fonts loaded, light theme and reduced motion, at **1280×900** and **360×690**. Before is clean `origin/main` at `b038891`; after is this audit. Both an insisting run and a plain-speaking run cover the open cover, first card, journal, evening, resolve, forecast and ending; the plain-speaking run also reaches a borrowed card. Screenshots and computed-style inventories stay outside the repository at `/Users/abdul/code/.lab-scratch/codex/murmur-font/` (`before-*` / `after-*`, and `before-reader-*` / `after-reader-*`).

Comparison: the ordinary pull preserves its face, colour, size and trust rotation. The cover and Saturday pencil labels regain the pencil colour. Journal pull and descriptions gain the missing marker components. Dilan's pages and the controls change only the leaked face/slant/colour; Literata wraps differently, so evening and ending pages can grow vertically. The first repo check caught the wider serif labels pushing the three-option fixture below 690px. Mood labels now use 14px and retained thoughts 17px to restore that fit. At 360×690 the card retains its internal scroll and journal space; all fixture options and the silence control fit without scrolling. No new layout or palette is introduced. Computed-style checks cover 320 states across both weeks, two themes and both viewports (including 16 borrowed cards); the dark screenshot run also checks the borrowed evening description (`after-dark-*-borrowed-evening.png`). The original light/dark pencil colours remain. Before/after contact sheets are `comparison-phone.jpg` and `comparison-desktop.jpg`.

Done for this audit: this table, desktop and phone screenshot comparison, repo checks, signed commit on main, green CI, deployment with matching `/release.json` and `dirty:false`, and the five-line scratch report requested by the owner. Owner acceptance of feel remains separate.
