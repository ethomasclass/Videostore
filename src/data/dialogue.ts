import type { Title } from './catalog'

/**
 * What the people in the store say. The shift is five hours of the same five jobs, so the
 * customers are the variety — they are written to be overheard rather than parsed, short
 * enough to read in one glance over a counter, and squarely of the era.
 *
 * Nothing here gates progress. A line the player misses costs them nothing but the joke.
 */

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!

/** Shouted at the room on the way in. */
export const GREETINGS: readonly string[] = [
  "Hey. Are you guys open till eleven? My pager says nine but my pager lies.",
  "I'm just looking. I say that every time and it has never once been true.",
  "Do you validate parking? There's no gate. I'm asking to see what you'll say.",
  "My whole family is in the car. No pressure, but the clock is running.",
  "Is the ice machine still broken? I'm not buying anything, I just think about it a lot.",
  "I have four dollars and a coupon from a competitor. Let's see where this goes.",
  "Don't tell me the ending. Don't tell me the beginning either. Surprise me.",
  "I rented something here in ninety-three and I'm still thinking about it.",
  "My nephew picked last time and we watched a talking dog movie twice. Twice.",
  "Quick question: is the guy from the space one also in the boat one? It's keeping me up.",
]

/** Said when the player walks up to someone mid-browse. */
export const BROWSING: readonly string[] = [
  "Does this look like a movie my girlfriend would like? Be honest. She's very specific.",
  "I've read the back of this box eleven times. I still don't know what happens.",
  "Every copy of the good one is out. Every single one. On a Tuesday.",
  "I'm boycotting anything with a number in the title. So far it's going badly.",
  "Is the sequel worse? Don't answer. Actually answer. But be gentle about it.",
  "I'm told the whole world ends when the year rolls over. So I'd like a comedy.",
  "My roommate says this one's a classic. My roommate has a lava lamp and no job.",
  "Do you work here or are you also just standing in a blue vest by coincidence?",
  "I only have the VCR at my mom's. So this is a whole logistical situation.",
  "I've been in the horror aisle forty minutes. I'm not even a horror guy.",
  "Is it weird to rent three movies for one night? Asking for me. It's me.",
  "The cover has a guy looking over his shoulder. Every cover has that. Why.",
]

/** Said standing at the counter, before the player rings them up. */
export const COUNTER_OPENERS: readonly string[] = [
  "Put it on the account. The account with the late fee on it. That account.",
  "Before you ring that up — hypothetically — how late is late?",
  "My membership card went through the wash. The card is fine. The pants are not.",
  "I'm gonna need a bag. I know it's two tapes. I'd like the bag.",
  "Any chance you've got the one with the bus? Everyone says there's one with a bus.",
  "Rewound both of them. Did it at home. Sat there. Watched the little wheels go.",
  "If I bring these back at midnight, is that tonight or tomorrow? Philosophically.",
  "You wouldn't have a pen, would you? I've got a whole thing to write down.",
  "Last time the tape ate itself twenty minutes in. I'm not mad. I'm just telling you.",
  "Do not let me leave without candy. I'm serious. Stop me at the door.",
]

/** Said while the player takes too long. Nobody waits politely in a video store. */
export const IMPATIENT: readonly string[] = [
  "No rush. My parking meter disagrees, but no rush.",
  "Should I come back? I can come back. I won't, but I can.",
  "Is the computer thinking or is it doing the thing where it pretends to think?",
  "I'm not tapping my foot. My foot is doing that on its own.",
  "Take your time. The movie starts whenever I get home, so. Whenever.",
]

/** Said on the way out, after the sale. */
export const FAREWELLS: readonly string[] = [
  "You're a lifesaver. I mean that in the loosest possible way.",
  "Be kind, rewind. I'm saying it to you. I don't know why.",
  "If this is bad I'm coming back here specifically to tell you about it.",
  "Tell your manager you were great. Say it was me. They won't check.",
  "Two nights. Got it. Two. I'm saying it out loud so it counts.",
  "See you Thursday. Unless the world ends. Then Friday.",
  "I'm gonna watch this and then think about it for a year. That's my whole thing.",
]

/** One side of a phone call, delivered straight into the clerk's ear. */
export const PHONE_CALLS: readonly string[] = [
  "Yeah hi, do you have the one with the guy? He's in everything. You know the guy.",
  "How late are you open tonight? Okay. And how late really?",
  "It's Marcy. If my husband is in your horror aisle, tell him dinner was at six.",
  "Do you do reservations? It's for Friday. There will be seven of us. It's a whole thing.",
  "What time does the drop box close? It's a slot? It can't close? Huh. Power move.",
  "I'm returning a tape by throwing it from my car in about five minutes. Heads up.",
  "Is this the pizza place? ... Well what WOULD you recommend?",
  "My VCR has been flashing twelve o'clock since March and I've decided to live with it. That's the whole call.",
  "Can you check if you have anything where a dog plays a sport? Any sport. Any dog.",
  "Do your video games work in a camcorder? Don't laugh. My nephew swears it works.",
]

export function phoneCall(): string {
  return pick(PHONE_CALLS)
}

/** Said instead of naming the title — the recommendation beat, in a customer's own words. */
export function requestLine(title: Title): string {
  const frames = [
    `I want ${title.vagueRequest}. That's all I've got.`,
    `My brother said to get ${title.vagueRequest}. He was very confident.`,
    `Looking for ${title.vagueRequest}. Don't make me act it out.`,
    `You know ${title.vagueRequest}? That one. Please.`,
  ]
  return pick(frames)
}

export type DialogueMood = 'greeting' | 'browsing' | 'counter' | 'impatient' | 'farewell'

const BY_MOOD: Record<DialogueMood, readonly string[]> = {
  greeting: GREETINGS,
  browsing: BROWSING,
  counter: COUNTER_OPENERS,
  impatient: IMPATIENT,
  farewell: FAREWELLS,
}

export function dialogue(mood: DialogueMood): string {
  return pick(BY_MOOD[mood])
}
