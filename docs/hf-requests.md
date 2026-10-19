# HF requests from The Two Voices

Game: The Two Voices (`adam0white/murmur`), built on `@adam0white/human-framework` 2.8.0 (items 1 and 2 checked against the 2.8.0 dist and still open). Each item says what is confirmed and what is assumed. The game works around each one in the host; none blocks release.

## 1. One outcome keeps only one commitment, even when `fulfills` lists two

**Confirmed (source and play):** `onFinished` in `agenda/agenda.js` keeps only the earliest-ending pending commitment, also when `outcome.fulfills` lists several ids. The doc comment says this is intended. On Wednesday Dilan has dinner with her sister and Mum. That dinner should keep "my word to Aylin" and also the daily "my call to Mum". HF keeps only Aylin's, and the evening review then says she did not keep the call to Mum.

**Workaround:** the host stages a second five-minute `call-mum` act right after the dinner (`Opt.alsoDoes` in `src/sim/game.ts`).

**Proposal:** commitments listed explicitly in `fulfills` are all kept. The earliest-ending rule applies only to action matching. Target 2.9.0.

## 2. One turning-away response serves every prompt

**Confirmed (source):** `bestResponse` in `promptings/promptings.js` picks the response with the highest practice and uses it for every prompting, whatever the cue. Dilan learns a phrase per situation: "Feet on the floor" for the alarm, "Walk away from it" for the canteen. HF then uses the most practised one for all prompts, so a phrase learned at the alarm also turns her away from gossip.

**Workaround:** the phrases are written generically enough to fit any moment. The game shows the most practised phrase as hers.

**Proposal:** an optional `cue` on a `PromptingResponse` (an action, tag or norm id). When cued responses match the current prompting, `bestResponse` prefers them, and it falls back to the global best. Target 2.9.0 or later.

## 3. `reviewLine` needs noun-phrase labels

**Confirmed (play):** "I didn't keep calling Mum" read badly, so the labels are written as noun phrases ("my alarm", "my call to Mum", "my word to Aylin"). The Pass reported the same. **Proposal:** document in `docs/api.md` that commitment labels must read after "I kept …", or accept an optional `reviewLabel`. Low priority.

## 4. A goal cannot argue against a temptation

**Confirmed (source):** goal terms are never negative. The half-built shelf can pull her toward building it, but it cannot count against the phone on the same evening. Only norms and commitments oppose a prompt. **Assumed:** this is intended, since goals pull and do not forbid. A note in the api doc would settle it. No change requested.
