# Playtest: first-timer, Claude Haiku (2026-10-19)

Tester: Claude Haiku, source unread. Seed 2, 360×780, dark mode, live build dcadc48. Report recorded verbatim below.

**Playtest report: The Two Voices, seed 2, 360×780, dark mode**

Screenshots are in `/private/tmp/claude-504/-Users-abdul-code-human-framework/675a9839-8299-4863-91be-017a92a76ff0/scratchpad/pt-haiku/shots/` (74 files, numbered in play order). I played Monday to Friday night and did not read the source.

**1. First minute**
I understood that two voices argue over each choice. The handwritten line is the pencil, and it always gives a reason to do the easy thing ("Five more. The alarm is more of a suggestion."). The bold options are mine. I tapped "Up. Feet on the floor." and the game answered "Later, she said." and then wrote "After I sleep five more minutes, then I will." I did not expect my choice to be answered with a counter-line in my own voice. I was unsure which voice I was taking. (`02-after-wake.png`, `03-after-choice1.png`)

**2. Thursday**
Yes, it felt hard, and most of the bad outcomes felt unfair to me, for three reasons:
- I slept through the alarm on Thursday after insisting on getting up on Monday and Tuesday. The pencil had already written "Five more."
- I chose "Say you overslept" (later) and it was refused. The pencil's "Say the ring road" happened. Murat said "The ring road again." Ece's request followed. (`50-thu-overslept-hold.png`)
- Insisting on "Water, and a lap of the yard" was refused: "Don't push me. Not today." then "The pencil had its way." (`56-thu-water-hold.png`)

The unfair part: a tap on a "later, maybe" option just produced "Later, she said." and the pencil's line happened. Nothing told me that "later" meant the game would choose for me. On Thursday night the game also showed "She's had enough of being pushed." (`42-wed-next4.png`, `53-thu-next3.png`). That was the first sign the game was keeping count, but it came without an explanation. It felt fair that the cost was real. It felt unfair that the refusal gave no reason beyond "Don't push me."

**3. Holding to insist**
- **When it worked:** Monday "Talk her through it" ("you insisted", "Alright, I'll do it.", `09-mon-ece-hold.png`). Tuesday "Up. Feet on the floor" ("Fine."), "That was me.", "Sit with Ece." and "Water, and a lap" ("Fine. Since you insist.", `28-tue-water-hold.png`). Thursday "Build the shelf" was accepted, and the cost showed later: "She put the back on backwards, tired, and took it off again."
- **When it stopped working:** "Call Mum" on Tuesday, "Phone on the floor" on Tuesday, "Say it's your sister's birthday" on Wednesday, and on Thursday "Up. Feet on the floor", "Say you overslept", "Water, and a lap" and "Write the day down". Each refusal read "Don't push me. Not today." and "Later, she said." (`30-tue-mum-hold.png`, `62-thu-write-hold.png`)
- **Pattern I saw:** Early holds on "she might" or "if you push" options worked. Holds on "later, maybe" and "not today" options failed more often as the count grew. I can't prove the exact rule from play alone, but the refusals clustered after several pushes.
- **What it cost:** the notebook kept the count. Tuesday: "You pushed me a lot today. I did it. I didn't like it." (`33-wed-start.png`). Thursday repeated it, with "Feet on the floor" and "Just say it plainly" in the margin (`63-thu-notebook.png`). The insisted outcome also tended to be worse: "fell asleep in front of the board", "back on backwards".

Friday's notebook turned warm ("You were right more than you were wrong.", `74-fri-late.png`), so the cost seems to reset by the end of the week.

**4. Dark mode**
- Readability was good. Cream text on dark brown, the red "you insisted" tag, and the grey pencil handwriting all read clearly. The notebook strikethroughs and checkmarks were easy to see.
- The pencil's replies to my choices use the same cream handwriting as my own ink lines. Examples: "Not now. After I leave it for later.", "I'll laugh along instead.", "If you insist. I'd rather not.", "Don't push me. Not today." (`05-mon-aylin.png`, `17-mon-phone-hold.png`, `30-tue-mum-hold.png`). So the pencil does speak in my hand, in first person. It works for the sting of it, but I could not tell apart which lines were "me" and which were the pencil talking as me.
- Some cards have a thin grey line above the choices, e.g. "I'll still have enough for bowling." (`68-fri-next2.png`). I read it as my inner voice, but I'm not certain.
- The option tags ("she might", "later, maybe", "if you push", "not today") were unclear. They looked like odds, not who is speaking. A few cards had two "she might" options and no clear ink option (`21-tue-next.png`, `23-tue-next.png`).

**5. Bugs and layout**
- No layout breakage at 360 px. No horizontal scroll that I saw.
- The "on with the day" tap timed out in several runs (in my Playwright script). The day advanced on its own timer each time, so I could not tell whether that is a game bug or a test-timing issue. Worth checking on a real phone.
- Some outcome lines contradicted my choice without a note. I chose "Say you overslept" on Monday and the log said "The ring road was solid." (`07-mon-murat-result.png`). The game was consistent, but a first-timer would think it misread the tap.
- Several cards repeated the same pencil lines across days ("Say the ring road", "Laugh. It's a bit funny."). That is intended, but it made Thursday feel like the same day again.

**6. Verdict**
The two-voice idea is strong. Holding to insist is a good mechanic, and the notebook turns the cost into something you can feel. The weak point is that the pencil wins almost every time I tap ink, and "later" hides that the game will pick for me. Tags don't say who is speaking, and refusals give little reason. Score: **6/10**.
