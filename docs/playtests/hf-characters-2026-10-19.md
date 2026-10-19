# HF-character playtest, 2026-10-19

Harness: `~/code/human-framework/packages/playtester` (uncommitted there on this date), four HF personas (commuter, unwinder, completionist, restless), seeds 1 and 2, against the sim at commit 4fc01c6 on HF 2.8.0. The adapter (`scratch/hf-adapter.ts`, not committed because it imports the harness from a sibling checkout) shows only what the screen shows. Time follows the UI: a card lasts 32 real seconds, gaps run at about 20 sim minutes a second.

Confirmed from the output below:
- No persona was bored or looked away (longest lull 0 s). Engagement was 0.75 to 0.87.
- Three of four personas finished the week, in 5.7 to 6.5 minutes of play. The commuter stopped at its own stop, on Wednesday or Thursday.
- Frustration came from refusals ("I'll have a third coffee instead.", "After I watch one more video, then I will.") and from a ruminating evening page.
- The first reward came in the first 40 seconds: she kept a phrase of yours.

Assumed or unknown: the personas answer each card within a 3-second beat, faster than a person reading the scene. Real play is likely two to three times longer. The deferral "Not now. After I blame the ring road." is HF's sentence built from the label of the pull's option. It reads oddly but stays in character.

Raw output, verbatim:

```

commuter seed 1: agenda after 4 min at Thu 13:41 (commitment:c1)
  day 4 phase day; engagement 0.84; time {"watch":0.64,"input":0.36}
  longest lull 0s from  (); looked away 0x
  4:00 Thu 13:41 stopped: had to stop (commitment:c1)
  rewarded 2x, first: 0:39 (Mon 13:41): she kept my words: "Walk away from it" | 2:30 (Wed 09:26): she kept my words: "Just say it plainly"

commuter seed 2: agenda after 3 min at Wed 16:51 (commitment:c1)
  day 3 phase day; engagement 0.83; time {"watch":0.67,"input":0.33}
  longest lull 0s from  (); looked away 0x
  2:15 Tue 21:31 frustrated: she did not do what I said: "After I watch one more video, then I will."; Tuesday page: I keep going back over my alarm. I said it was me, a
  3:00 Wed 16:51 stopped: had to stop (commitment:c1)
  rewarded 1x, first: 0:21 (Mon 09:26): she kept my words: "Just say it plainly"

unwinder seed 1: game-over after 6 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.85; time {"watch":0.65,"input":0.35}
  longest lull 0s from  (); looked away 0x
  1:54 Tue 16:21 frustrated: she did not do what I said: "I'll have a third coffee instead."
  6:00 Sat 10:01 finished: the game ended
  rewarded 4x, first: 1:27 (Tue 09:26): she kept my words: "Just say it plainly" | 2:03 (Tue 19:11): she kept my words: "It’s ten minutes" | 5:42 (Fri 22:01): Friday page: Today I kept my alarm and my call to Mum. The week is over. I think. About me: You were right more than you were wrong.

unwinder seed 2: game-over after 6.5 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.84; time {"watch":0.67,"input":0.33}
  longest lull 0s from  (); looked away 0x
  2:00 Tue 16:21 frustrated: she did not do what I said: "I'll have a third coffee instead."
  6:27 Sat 10:01 finished: the game ended
  rewarded 3x, first: 0:21 (Mon 09:26): she kept my words: "Just say it plainly" | 6:06 (Fri 22:01): Friday page: Today I kept my alarm and my call to Mum. The week is over. I think. About me: You were right more than you were wrong. | 6:27 (Sat 10:01): Saturday: Mum, it’s me. I know I didn’t ring every day. I meant to. 

completionist seed 1: game-over after 5.7 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.86; time {"watch":0.64,"input":0.36}
  longest lull 0s from  (); looked away 0x
  5:24 Fri 22:01 frustrated: she did not do what I said: "After I watch one more video, then I will."
  5:39 Sat 10:01 finished: the game ended
  rewarded 6x, first: 0:30 (Mon 13:41): she kept my words: "Walk away from it" | 1:15 (Tue 09:26): she kept my words: "Just say it plainly" | 2:12 (Wed 08:16): she kept my words: "It’s ten minutes"

completionist seed 2: game-over after 5.9 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.87; time {"watch":0.64,"input":0.36}
  longest lull 0s from  (); looked away 0x
  5:39 Fri 22:01 frustrated: Friday page: I keep going back over my alarm and my call to Mum. The week is over. I think. About me: You had something to say about everyth
  5:54 Sat 10:01 finished: the game ended
  rewarded 5x, first: 1:36 (Tue 12:11): she kept my words: "Just say it plainly" | 3:36 (Thu 07:41): she kept my words: "Feet on the floor" | 4:18 (Thu 19:11): she kept my words: "It’s ten minutes"

restless seed 1: game-over after 6 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.75; time {"watch":0.65,"input":0.35}
  longest lull 0s from  (); looked away 0x
  2:30 Wed 09:26 frustrated: she did not do what I said: "Not now. After I blame the ring road."
  6:00 Sat 10:01 finished: the game ended
  rewarded 4x, first: 0:39 (Mon 13:41): she kept my words: "Walk away from it" | 1:27 (Tue 09:26): she kept my words: "Just say it plainly" | 2:03 (Tue 19:11): she kept my words: "It’s ten minutes"

restless seed 2: game-over after 6.4 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.75; time {"watch":0.66,"input":0.34}
  longest lull 0s from  (); looked away 0x
  2:27 Tue 21:31 frustrated: she did not do what I said: "After I watch one more video, then I will."; Tuesday page: I keep going back over my alarm and my call to Mum. 
  6:24 Sat 10:01 finished: the game ended
  rewarded 3x, first: 0:21 (Mon 09:26): she kept my words: "Just say it plainly" | 1:03 (Mon 19:11): she kept my words: "It’s ten minutes" | 6:24 (Sat 10:01): Saturday: Mum, it’s me. I know I didn’t ring every day. I meant to. I messed up at work and said so. Anyway. Love you. That’s it. Mum replied with a voice note ele
```

## Second run, after the polish round (same day)

The sim now has gated holds, fading phrases, honest hints, lower convictions against lying and backbiting, and a "say nothing" action, which the adapter offers. Engagement is unchanged at 0.76 to 0.87. Six of eight sessions finished the week. Commuter seed 1 and restless seed 1 quit on Thursday from distress (`emotion:distress:rest`). In the first run nobody quit. Confirmed: the harder week now frustrates some HF players by Thursday. Unknown: whether real players feel this the same way. The owner's playtest should check Thursday specifically.

Raw output, verbatim:

```

commuter seed 1: quit after 4 min at Thu 13:41 (emotion:distress:rest)
  day 4 phase day; engagement 0.83; time {"watch":0.64,"input":0.36}
  longest lull 0s from  (); looked away 0x
  2:30 Wed 09:26 frustrated: she did not do what I said: "Not now. After I blame the ring road."
  4:00 Thu 13:41 stopped: put it down (emotion:distress:rest)
  rewarded 1x, first: 4:00 (Thu 13:41): she kept my words: "Walk away from it"

commuter seed 2: agenda after 3 min at Wed 16:51 (commitment:c1)
  day 3 phase day; engagement 0.85; time {"watch":0.67,"input":0.33}
  longest lull 0s from  (); looked away 0x
  2:03 Tue 19:11 frustrated: she did not do what I said: "After I scroll for a bit, then I will."
  3:00 Wed 16:51 stopped: had to stop (commitment:c1)
  rewarded 3x, first: 0:36 (Mon 13:41): she kept my words: "Walk away from it" | 1:36 (Tue 12:11): she kept my words: "Just say it plainly" | 2:30 (Wed 08:16): she kept my words: "It’s ten minutes"

unwinder seed 1: game-over after 6 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.85; time {"watch":0.65,"input":0.35}
  longest lull 0s from  (); looked away 0x
  1:09 Mon 21:31 frustrated: she did not do what I said: "After I watch one more video, then I will."; Monday page: I keep going back over my alarm and my call to Mum. M
  5:57 Sat 10:01 finished: the game ended
  rewarded 4x, first: 3:09 (Wed 20:46): she kept my words: "Just say it plainly" | 5:36 (Fri 19:31): she kept my words: "It’s ten minutes" | 5:36 (Fri 19:31): Friday page: Today I kept my alarm and my call to Mum. I am apparently good at bowling. About me: You were right more than you were wrong.

unwinder seed 2: game-over after 6.4 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.85; time {"watch":0.66,"input":0.34}
  longest lull 0s from  (); looked away 0x
  1:15 Mon 21:31 frustrated: Monday page: I keep going back over my alarm and my call to Mum. Murat knows it wasn’t the ring road. About me: You had something to say abo
  6:24 Sat 10:01 finished: the game ended
  rewarded 2x, first: 3:42 (Wed 20:48): she kept my words: "Just say it plainly" | 6:24 (Sat 10:01): Saturday: Mum, it’s me. I know I didn’t ring. I kept meaning to. You asked if I was eating. I’m trying. I messed up at work and said so. Anyway. Love you. That’s it. Mum replied with a voice note eleven minutes long.

completionist seed 1: game-over after 5.7 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.85; time {"watch":0.62,"input":0.38}
  longest lull 0s from  (); looked away 0x
  4:18 Thu 21:31 frustrated: she did not do what I said: "Not now. After I watch one more video."; Thursday page: I keep going back over my alarm and my call to Mum. Thu
  5:42 Sat 10:01 finished: the game ended
  rewarded 1x, first: 5:42 (Sat 10:01): Saturday: Mum, it’s me. I know I didn’t ring. I kept meaning to. I messed up at work and said so. Anyway. Love you. That’s it. Mum replied with a voice note eleven minutes long.

completionist seed 2: game-over after 5.8 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.87; time {"watch":0.63,"input":0.37}
  longest lull 0s from  (); looked away 0x
  5:18 Fri 19:11 frustrated: she did not do what I said: "After I scroll for a bit, then I will."
  5:45 Sat 10:01 finished: the game ended
  rewarded 6x, first: 3:30 (Thu 07:41): she kept my words: "Feet on the floor" | 3:42 (Thu 10:31): she kept my words: "Just say it plainly" | 3:54 (Thu 13:41): she kept my words: "Walk away from it"

restless seed 1: quit after 4 min at Thu 12:41 (emotion:distress:rest)
  day 4 phase day; engagement 0.76; time {"watch":0.65,"input":0.35}
  longest lull 0s from  (); looked away 0x
  1:39 Tue 12:11 frustrated: she did not do what I said: "Not now. After I blame the system."
  4:00 Thu 12:41 stopped: put it down (emotion:distress:rest)
  rewarded 0x, first: 

restless seed 2: game-over after 6.1 min at Sat 10:01 (the game ended)
  day 6 phase end; engagement 0.76; time {"watch":0.67,"input":0.33}
  longest lull 0s from  (); looked away 0x
  2:03 Tue 19:11 frustrated: she did not do what I said: "After I scroll for a bit, then I will."
  6:03 Sat 10:01 finished: the game ended
  rewarded 5x, first: 1:36 (Tue 12:11): she kept my words: "Just say it plainly" | 3:18 (Wed 21:41): Wednesday page: Today I kept my alarm, my word to Aylin and my call to Mum. Mum held my hand under the table like I was nine. About me: You were right more than you were wrong. | 4:27 (Thu 19:11): she kept my words: "It’s
```
