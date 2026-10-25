# Plain English

Use full grammatical sentences with articles and verbs. Keep button labels short and literal.
Say what happens. Explain a game term when it first appears. Name each thing one way.
Introduce at most one new idea per screen. Prefer familiar words and grade-seven instructions. Character dialogue may be richer, but it must be understandable.
Describe approximate state in clear English. Cut words the player does not need.
Preserve the meaning, rules, difficulty, names, and culture.

Rewrite player text at its source. Keep semantic IDs and HF action labels stable. Display lookup tables cannot provide complete story coverage. Current exports must replay exactly. Older exports whose text fingerprints differ must refuse with a plain start-fresh message.

For this rewrite, compare full seeded runs before and after with only known prose fields blanked. Keep every semantic key, enum, chosen action, number, clock, RNG and array order in the comparison. Map learned phrase text back to its stable phrase ID. Read the rendered text and full-run distinct lines. Check longer sentences at 360×690 and 1280×800.

## Published narration adoption

HF 2.21.0 supplies the plain narration pack. Fresh people persist `lexicon.plainEnglish: true`.
Replay reads that saved choice. A pinned chapter keeps its admitted people and their lexicons.
Do not set the flag while restoring a save. Current exports still require the full pinned state to replay exactly.

Lesson: a native return already contains its source inputs. Journal reconstruction must read the source
records with their original pinned chapter, then process only the receiving suffix. Requeuing the inherited
inputs loses the source answers. Treat `cast-pause` as a completed-day boundary, as the simulation replay does.
The regression covers a resumed journal and the existing native-return fixture.
