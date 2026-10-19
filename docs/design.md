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
- **The hints are honest.** Her will runs at temperature 0, so the mood words on each option ("she's willing", "only with a push") are what HF predicts she will do. Runs differ through the seed's small differences in her habits.
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
- **Monday:** say it or say nothing. The pull, the lie at the depot (only if she was late), the gossip at lunch, Mum.
- **Tuesday:** hold to insist (introduced on the first card). Monday's resolve prints on its card.
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

## Deferred (target: after the owner's first playtest)
- A second week.
- Other people as HF persons (Ece, Mum).
