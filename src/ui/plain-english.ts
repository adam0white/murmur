/** Display copy only. Stored text and simulation fingerprints stay unchanged. */
const copy: Readonly<Record<string, string>> = {
  'Up. Feet on the floor.': 'Get up and put your feet on the floor.',
  'Five more.': 'Sleep for five more minutes.',
  'Five more. You were up till all hours.': 'Sleep for five more minutes. You stayed up very late.',
  'Five more. The alarm is more of a suggestion.':
    'Sleep for five more minutes. You don’t have to obey the alarm.',
  'You said rest matters. Five more.': 'You said rest matters. Sleep for five more minutes.',
  'The ring road.': 'Say the ring road delayed you.',
  'Say the ring road. Everyone says the ring road.':
    'Say the ring road delayed you. Everyone uses that excuse.',
  '15:20. The delivery board is red with late drops. Her eyes keep closing on the screen.':
    'It is 15:20. Red marks on the delivery board show late deliveries. Her eyes keep closing as she looks at the screen.',
  '15:20. The board again. The same red. Her eyes sting.':
    'It is 15:20. The delivery board still shows late deliveries. Her eyes sting.',
  '15:20. The board is red. Her head is full of sand.':
    'It is 15:20. The delivery board shows late deliveries. She feels tired and cannot think clearly.',
  '15:20. Red again. She reads the same postcode three times.':
    'It is 15:20. The delivery board shows late deliveries again. She reads the same postcode three times.',
  '15:20. Friday red. She yawns so hard her jaw clicks.':
    'It is 15:20 on Friday. The delivery board shows late deliveries. She yawns so hard her jaw clicks.',
  '15:20. The board is red with late drops. The kettle is right there.':
    'It is 15:20. Red marks on the delivery board show late deliveries. The kettle is nearby.',
  '15:20. The board again. The same red. The kettle again.':
    'It is 15:20. The delivery board still shows late deliveries. The kettle is nearby again.',
  '15:20. The afternoon dip. Somebody has left biscuits by the kettle.':
    'It is 15:20. She feels tired this afternoon. Somebody has left biscuits by the kettle.',
  '15:20. The board goes red on schedule. So does she.':
    'It is 15:20. The delivery board shows late deliveries again. She feels frustrated.',
  '15:20. Friday afternoon. Red board, warm kettle, two hours to go.':
    'It is 15:20 on Friday. The delivery board shows late deliveries. The kettle is warm. Her shift ends in two hours.',
  'Third coffee. You’ve earned it.': 'Have a third coffee. You’ve earned it.',
  'Coffee. Same as yesterday.': 'Have a coffee, as you did yesterday.',
  'Coffee. Get the board green.': 'Have a coffee and finish routing the deliveries.',
  'Coffee. Today of all days.': 'Have a coffee. You need one today.',
  'Coffee. Who sleeps anyway.': 'Have a coffee. Who needs sleep anyway?',
  'Coffee. It’s Friday. Nobody counts on Friday.':
    'Have a coffee. It’s Friday. Nobody counts cups on Friday.',
  'Water, and a lap of the yard.': 'Drink some water and walk around the yard.',
  'The third coffee. The board was green by five.':
    'She had a third coffee. She finished routing the deliveries by five.',
  'Coffee. The board went green. Her hands buzzed a little.':
    'She had coffee and finished routing the deliveries. Her hands shook a little.',
  'Coffee, and a biscuit nobody claimed. Green by five.':
    'She had coffee and a biscuit nobody claimed. She finished routing the deliveries by five.',
  'Coffee. She cleared the board and felt like a wire.':
    'She had coffee and finished routing the deliveries. She felt tense and restless.',
  'Coffee. Green by five. Friday’s problem now is tonight.':
    'She had coffee and finished routing the deliveries by five. Now she has Friday evening to think about.',
  'A lap of the yard. She came back and fell asleep in front of the board. Murat saw.':
    'She walked around the yard. She came back and fell asleep in front of the delivery board. Murat saw her.',
  'A lap of the yard. The parked vans looked like sleeping animals. The board went green by five.':
    'She walked around the yard. The parked vans looked like sleeping animals. She finished routing the deliveries by five.',
  'Text her: tomorrow, promise.': 'Text Mum and promise to call tomorrow.',
  'Phone on the floor. Sleep.': 'Put the phone on the floor and go to sleep.',
  'One more video.': 'Watch one more video.',
  'Ece, the new driver, calls from her van. Lost in the new estate. Trying not to cry.':
    'Ece, the new driver, calls from her van. She is lost in the new estate and is trying not to cry.',
  'Send her the map pin. You have forty drops to route.':
    'Send her the map location. You have forty deliveries to route.',
  'Send the pin.': 'Send her the map location.',
  'Fifteen minutes, street by street. Ece made her drop. Dilan’s deliveries were still late.':
    'Dilan guided Ece street by street for fifteen minutes. Ece delivered the parcel. Dilan’s deliveries were still late.',
  'Fifteen minutes, street by street. Ece made her drop.':
    'Dilan guided Ece street by street for fifteen minutes. Ece delivered the parcel.',
  'Leave it on read.': 'Read the message without replying.',
  'Tell Aylin: tonight, on the bus.': 'Tell Aylin you will call Mum tonight on the bus.',
  'Later. Nobody does Mum before tea.': 'Call Mum later. Nobody calls her before having tea.',
  'The eleven o’clock drops went to the wrong depot. Her routing error. Murat asks the room who did it.':
    'The eleven o’clock deliveries went to the wrong depot because Dilan routed them incorrectly. Murat asks who made the mistake.',
  'A sandwich over the keyboard. The afternoon drops were routed by one.':
    'She ate a sandwich at her keyboard. She finished routing the afternoon deliveries by one.',
  'Keep your head down.': 'Stay quiet about the mistake.',
  'Say: wouldn’t miss it.': 'Tell Aylin you will be at her birthday dinner.',
  'Take it. Double time. Aylin will save you a plate.':
    'Take the route. You will earn double pay. Aylin will save you some dinner.',
  'Thirty-one drops in the dark. She parked the van at 19:20, legs humming.':
    'She made thirty-one deliveries in the dark. She parked the van at 19:20. Her legs ached.',
  'Six o’clock, nearly. Ece is waiting by the board with two teas and a notebook. She has drawn columns.':
    'It is nearly six o’clock. Ece is waiting by the delivery board with two teas and a notebook. She has drawn columns.',
  'Forty minutes, street by street. Ece’s columns were better than the board’s. Dilan caught the late bus.':
    'They spent forty minutes going through the streets. Ece’s columns were clearer than the delivery board’s. Dilan caught the late bus.',
  'Home. The shelf. The screws have been in their little bag since March.':
    'Dilan is home. The unfinished shelf is still there. The screws have been in their little bag since March.',
  'Put something on.': 'Watch a show.',
  'Two episodes of a show about people renovating a farmhouse.':
    'She watched two episodes of a show about people renovating a farmhouse.',
  'Two sides and the back. One screw left over, which is normal, apparently.':
    'She built two sides and the back of the shelf. One screw was left over. Apparently that is normal.',
  'The shelf: two sides and a back. The rest of it looks at her.':
    'The shelf has two sides and a back. She can still see the unfinished parts.',
  'Go. Twenty minutes counts.': 'Go to the gym. Even twenty minutes counts.',
  'Twenty minutes on the rowing machine. The receptionist said “welcome back” like she meant it.':
    'She spent twenty minutes on the rowing machine. The receptionist said “welcome back” like she meant it.',
  'Another game.': 'Play another game.',
  'A page. Her handwriting was worse than she remembered, and more hers.':
    'She wrote a page. Her handwriting was worse than she remembered, but it felt more like her own.',
  'Three lines. One of them was about the cake.': 'She wrote three lines. One of them was about the cake.',
  'A page and a bit. She drew a box round one sentence.':
    'She wrote a little more than a page. She drew a box around one sentence.',
  'Forty minutes of other people’s holidays.':
    'She watched videos of other people’s holidays for forty minutes.',
  'Feet on the floor. Not yet. I heard you, though.': 'I’m not ready to get up yet. I heard you, though.',
  'Making time for Ece. I haven’t forgotten what you asked.':
    'I could make time for Ece. I haven’t forgotten what you asked.',
  'Water and a walk. I wanted coffee, but I can see why you said it.':
    'You suggested water and a walk. I wanted coffee, but I can see why you said it.',
  'Not like that. Beside her.': 'Sit beside Ece and explain it quietly.',
  'Promise tomorrow, and Friday’s close.': 'Promise to practise tomorrow and help close the depot on Friday.',
  'Promise Thursday, and Friday’s close.':
    'Promise to practise on Thursday and help close the depot on Friday.',
  'Stay for the close.': 'Stay to help close the depot.',
  'Let it stand.': 'Let Ece use those words.',
  'Soften it.': 'Suggest gentler words.',
  'Home. The shelf stands in the corner. The books are still in a pile beside it.':
    'Dilan is home. The shelf stands in the corner. The books are still in a pile beside it.',
  'Home. The shelf parts have acquired a clean outline in the dust.':
    'Dilan is home. Dust has gathered around the unfinished shelf parts.',
  'Tea first. There is no shelf emergency.': 'Have tea first. The shelf can wait.',
  'Other people’s dinners for a bit.': 'Watch videos of other people’s dinners for a bit.',
  'Other people’s dinners, all the way home.':
    'She watched videos of other people’s dinners all the way home.',
  'Half a page. A grease mark from Aylin’s container.':
    'She wrote half a page. Aylin’s container left a grease mark on it.',
  'One short video. No more talking.': 'Watch one short video. You have talked enough.',
  'Half a page about dinner. It counts.': 'Write half a page about dinner. It counts.',
  'Save the leftovers photo. Phone down.': 'Save the photo of the leftovers and put the phone down.',
  'Under the fruit bowl. One corner still showed.':
    'She put the letter under the fruit bowl. One corner still showed.',
  'Her old columns. She could read them at a glance. Ece went back to her own sheet.':
    'She restored her old columns and could read them at a glance. Ece went back to her own sheet.',
  'The ring road. He has a whole shift to think about.':
    'Say the ring road delayed you. He has a whole shift to think about.',
  'Ece unfolded a map of places to sit without buying anything. Shade, backs on seats, closing times. She was checking it between courier shifts and logistics classes. “It isn’t an accessibility survey,” she said. Dilan asked before keeping a copy.':
    'Ece unfolded a map of places to sit without buying anything. It listed shade, seats with backs, and closing times. She checked it between courier shifts and logistics classes. “It isn’t an accessibility survey,” she said. Dilan asked before keeping a copy.',
  'The bus home. Mum’s voice note is still at the top of her messages.':
    'Dilan is on the bus home. Mum’s voice note is still at the top of her messages.',
  'The bus home. Mum’s number is right there. So is everything else.':
    'Dilan is on the bus home. She can call Mum or look at other things on her phone.',
  'The bus home. The same seat. Mum’s number, one tap away.':
    'Dilan is on the bus home, in the same seat. She can call Mum with one tap.',
  'The bus home. Rain on the window. Mum’s number.':
    'Dilan is on the bus home. Rain runs down the window. Mum’s number is on her phone.',
  'The bus home. A man opposite is on the phone to his mum, loudly. It’s a sign, or it isn’t.':
    'Dilan is on the bus home. A man opposite is talking loudly to his mum on the phone. Perhaps she should call hers too.',
  'The bus home. Friday. Mum’s number, and every video in the world.':
    'Dilan is on the bus home on Friday. She can call Mum or watch videos.',
  'The bus home. A missed call from Mum, followed by “Nothing urgent”.':
    'Dilan is on the bus home. Her phone shows a missed call from Mum and a message saying “Nothing urgent”.',
  'The bus home. Mum’s number above Aylin’s. The family, in alphabetical order.':
    'Dilan is on the bus home. Her phone lists Mum’s number above Aylin’s, in alphabetical order.',
  'The early bus. A whole seat to herself. Mum’s number.':
    'Dilan is on the early bus and has a seat to herself. Mum’s number is on her phone.',
  'The later bus. No seat. Mum’s number, under her thumb.':
    'Dilan is standing on the later bus. Her thumb is over Mum’s number on her phone.',
  'Bed, late. Cake crumbs in the bag. The beach photo, still.':
    'Dilan is in bed late. There are cake crumbs in her bag. The beach photo is still on her phone.',
  'The bus home. Mum has sent a photograph of something too close to the lens.':
    'Dilan is on the bus home. Mum has sent a photograph taken too close to its subject to see what it is.',
  'The bus home. Mum has typed “Are you on the bus” without a question mark.':
    'Dilan is on the bus home. Mum has typed “Are you on the bus” without a question mark.',
  '21:30. Bed. The phone is warm in her hand. The beach photo is still the lock screen.':
    'It is 21:30. Dilan is in bed. The phone is warm in her hand. The beach photo is still on its lock screen.',
  '21:30. Bed. The beach photo lights up when she touches the phone. Someone is cropped out of it.':
    'It is 21:30. Dilan is in bed. The beach photo lights up when she touches the phone. Someone is cropped out of it.',
  '21:30. Bed. The notebook from March is under the phone, which is under her thumb.':
    'It is 21:30. Dilan is in bed. She is using her phone. The notebook she bought in March is underneath it.',
  '22:00. Bed. The week is nearly done with her.': 'It is 22:00. Dilan is in bed. Her week is almost over.',
  '06:40, Tuesday. She has one foot out. Negotiations continue.':
    'It is 06:40 on Tuesday. She has one foot out of bed but has not decided to get up.',
  'Twenty minutes. Mum talked about the neighbour’s roof. Dilan laughed twice.':
    'They talked for twenty minutes. Mum told her about the neighbour’s roof. Dilan laughed twice.',
  'One more video. Then sleep. Honestly.': 'Watch one more video, then go to sleep. Honestly.',
  'Just one. You were good today. Ish.': 'Watch just one video. You did well today, more or less.',
  'A man restoring a rusty knife. Then another man, another knife.':
    'She watched a man restore a rusty knife. Then she watched another man restore another knife.',
  'Thumbs up. Done. Back to bed for a bit.': 'Send a thumbs-up and go back to bed for a bit.',
  'Loading dock. The pigeon brought a friend.': 'She ate on the loading dock. The pigeon brought a friend.',
  'Another game. She got a strike and Ece screamed.':
    'She played another game. She got a strike and Ece screamed.',
  'The gym bag by the door. She trips on it, as planned.':
    'Her gym bag is by the door. She trips on it, as planned.',
  'She lay awake past midnight. The third coffee.':
    'She lay awake past midnight because of the third coffee.',
  'Text her: can’t make it out. Call tomorrow.':
    'Text Mum to say you cannot see what is in the photo and will call tomorrow.',
  'Text her: saw your call. Tomorrow, promise.':
    'Text Mum to say you saw her call and promise to call tomorrow.',
  'Text her: going to Aylin’s. Ring tomorrow.':
    'Text Mum to say you are going to Aylin’s and will call tomorrow.',
  'Text her: on the bus. Call tomorrow.': 'Text Mum to say you are on the bus and will call tomorrow.',
  'Text her: tomorrow. A proper Saturday call.': 'Text Mum to promise a longer call on Saturday.',
  'A video about getting to bed earlier. Then its second part.':
    'She watched a video about getting to bed earlier. Then she watched its second part.',
  'Feet on the floor. Drive it round yourself.': 'Get up and deliver it yourself.',
  'Home, with the evening still hers.': 'Dilan is home and can choose how to spend her evening.',
  'Feet down. Before I start bargaining.': 'I’ll get up before I start bargaining.',
  'Yes. Out of bed this time.': 'Yes, I’m getting out of bed this time.',
  'Up, then. The floor is cold.': 'I’ll get up, then. The floor is cold.',
  'Friday. Feet on the floor.': 'It’s Friday. I’ll put my feet on the floor.',
  'Five minutes. I’m staying here.': 'I’m staying here for five more minutes.',
  'Not yet. One more alarm.': 'I’m not ready yet. I’ll wait for one more alarm.',
  'Five more. Then I’ll face it.': 'I’ll sleep for five more minutes. Then I’ll face the day.',
  'Coffee, then. The board is still red.':
    'I’ll have coffee, then. The delivery board still shows late deliveries.',
  'One cup before I face the board again.': 'I’ll have one cup before I face the delivery board again.',
  'Coffee. Two hours left.': 'I’ll have coffee. My shift ends in two hours.',
  'Water first. Then outside for a minute.': 'I’ll drink some water, then go outside for a minute.',
  'Yes. Away from this screen for a minute.': 'Yes, I’ll step away from this screen for a minute.',
  'A short walk. Then the last drops.': 'I’ll take a short walk, then finish routing the last deliveries.',
  'Something easy for the ride home.': 'I want something easy to watch on the ride home.',
  'Friday. I want the bus ride to myself.': 'It’s Friday. I want the bus ride to myself.',
  'A message, then. I’m not calling now.': 'I’ll send a message, then. I’m not calling now.',
  'Ten minutes. I can ring Mum.': 'I have ten minutes. I can call Mum.',
  'Mum first. The videos can wait.': 'I’ll call Mum first. The videos can wait.',
  'A few lines before I sleep.': 'I’ll write a few lines before I sleep.',
  'The notebook. There’s a week to put down.': 'I’ll open the notebook. I have a week to write about.',
  'One video. I’m not ready for sleep.': 'I’ll watch one video. I’m not ready for sleep.',
  'A video before I turn out the light.': 'I’ll watch a video before I turn out the light.',
  'It’s nearly the weekend. One more.': 'It’s nearly the weekend. I’ll watch one more video.',
  'Phone down. I’m done for tonight.': 'I’ll put the phone down. I’m done for tonight.',
  'No more screen. I’m going to sleep.': 'I’ll stop looking at the screen. I’m going to sleep.',
  'It blew over. Leave it.': 'Nobody is talking about the mistake now. Leave it.',
  'Keep it. You’ll go. Next week, properly.': 'Keep the gym membership. You’ll go regularly next week.',
  'The shelf parts still have their patch of floor.': 'The unfinished shelf parts are still on the floor.',
  'She needed me less by the end. I still missed the bus.':
    'By the end, Ece needed less help. I still missed the bus.',
  'The pan caught. We sat down anyway.': 'The food started to burn in the pan. We sat down anyway.',
  'Aylin sat. The pan caught a little. They ate round that bit.':
    'Aylin sat down. The food started to burn in the pan. They ate around the burnt part.',
  'Saturday. The kettle is mine for a bit.': 'It’s Saturday. I have some time to myself for tea.',
  'I got up this time. Feet on the floor.': 'I got up and put my feet on the floor this time.',
  'I called her. Your idea, in the end.': 'I called her. In the end, I followed your idea.',
  'She can close it now. My evening went somewhere else.':
    'Ece can close the depot now. I spent my evening helping her.',
  'Ece never asked to shadow her again. She asked Murat.':
    'Ece never asked to watch Dilan work again. She asked Murat instead.',
  'Saturday’s call to Mum outlasted the kettle.':
    'Saturday’s call to Mum lasted longer than it took the kettle to boil.',
};

export function plainEnglish(text: string): string {
  const exact = copy[text];
  if (exact) return exact;
  return text
    .replace(/^A voice note from Aylin: /, 'Aylin sends a voice note: ')
    .replace(/^A voice note from Mum: /, 'Mum sends a voice note: ')
    .replace(/^Murat, by the kettle: /, 'Murat says by the kettle: ')
    .replace(/^Murat, to the room: /, 'Murat calls across the room: ')
    .replace(/^Lunch on the loading dock\. /, 'Dilan is eating lunch on the loading dock. ')
    .replace(/^Saturday morning\. /, 'It is Saturday morning. ')
    .replace(
      'A tenancy renewal letter by the door. Her name in the window.',
      'A tenancy renewal letter is by the door. Her name is in the envelope window.',
    )
    .replace(
      /^Home, with the evening still hers\. /,
      'Dilan is home and can choose how to spend her evening. ',
    )
    .replace(
      "she's firmly against it; a small chance she'll listen",
      'She is firmly against it, but there is a small chance she will listen.',
    )
    .replace(
      '06:40, Monday. The alarm. The half-built shelf watches from the corner.',
      'It is 06:40 on Monday. Her alarm rings. The unfinished shelf is in the corner.',
    )
    .replace(
      '06:40, Tuesday. She slept late. It shows.',
      'It is 06:40 on Tuesday. She stayed up late and looks tired.',
    )
    .replace(
      '06:40, Tuesday. Grey light. The shelf.',
      'It is 06:40 on Tuesday. Grey light falls on the unfinished shelf.',
    )
    .replace(
      '06:40, Wednesday. Heavy. Aylin’s birthday.',
      'It is 06:40 on Wednesday. She feels tired. Today is Aylin’s birthday.',
    )
    .replace('06:40, Wednesday. Aylin’s birthday.', 'It is 06:40 on Wednesday. Today is Aylin’s birthday.')
    .replace(
      '06:40, Thursday. Cake for breakfast is a choice.',
      'It is 06:40 on Thursday. She could have cake for breakfast.',
    )
    .replace('06:40, Thursday. Cake for breakfast.', 'It is 06:40 on Thursday. There is cake for breakfast.')
    .replace('06:40, Friday. Nearly. Nearly.', 'It is 06:40 on Friday. The weekend is almost here.')
    .replace('06:40, Friday.', 'It is 06:40 on Friday.')
    .replace('06:40. The alarm would like equal time.', 'It is 06:40. Her alarm rings.')
    .replace(
      'Five more. Last night is still in your eyes.',
      'Sleep for five more minutes. You still feel tired after last night.',
    )
    .replace(
      'Five more. You know exactly how late you can leave it.',
      'Sleep for five more minutes. You know how late you can get up.',
    )
    .replace(/^The bus home\. /, 'Dilan is on the bus home. ')
    .replace(/^21:30\. Bed\. /, 'It is 21:30. Dilan is in bed. ')
    .replace(/^22:00\. Bed\. /, 'It is 22:00. Dilan is in bed. ')
    .replace(/^Lunch\. /, 'It is lunchtime. ')
    .replace(/^Aylin’s kitchen\. /, 'Dilan is in Aylin’s kitchen. ')
    .replace(/^06:40, (Monday|Tuesday|Wednesday|Thursday|Friday)\. /, 'It is 06:40 on $1. ');
}
