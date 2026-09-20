export type Genre = 'action' | 'comedy' | 'horror' | 'scifi' | 'family' | 'drama'

export interface Title {
  id: string
  title: string
  genre: Genre
  year: number
  /** Back-of-box copy, for the inspect view. */
  tagline: string
  /** How a customer asks for it without knowing the name. Feeds the recommendation beat. */
  vagueRequest: string
  /** Shelf stock at open. New releases run thin on purpose. */
  copies: number
  newRelease?: boolean
}

export const GENRE_LABEL: Record<Genre, string> = {
  action: 'Action & Adventure',
  comedy: 'Comedy',
  horror: 'Horror',
  scifi: 'Sci-Fi',
  family: 'Family',
  drama: 'Drama',
}

/**
 * Every title is an original parody — evokes an era archetype without borrowing a real mark.
 * `vagueRequest` is the puzzle side: the customer describes the movie, never names it.
 */
export const CATALOG: Title[] = [
  // --- Action ---
  { id: 'hard-to-perish', title: 'Hard to Perish', genre: 'action', year: 1994, copies: 4,
    tagline: 'He only came for the office party.',
    vagueRequest: 'the one where the guy is barefoot in a skyscraper the whole time' },
  { id: 'velocity-bus', title: 'Velocity Bus', genre: 'action', year: 1995, copies: 3,
    tagline: 'Drop below fifty and the city goes up.',
    vagueRequest: 'the bus one, it cannot slow down or it blows up' },
  { id: 'cliffdiver', title: 'Cliffdiver', genre: 'action', year: 1996, copies: 2,
    tagline: 'No rope. No chance. No problem.',
    vagueRequest: 'mountains, a briefcase of money, lots of falling' },
  { id: 'alcatraz-protocol', title: 'Alcatraz Protocol', genre: 'action', year: 1997, copies: 3,
    tagline: 'The island nobody escapes. Twice.',
    vagueRequest: 'the prison island one with the chemical rockets' },
  { id: 'maximum-vengeance-3', title: 'Maximum Vengeance 3', genre: 'action', year: 1998, copies: 5,
    tagline: 'This time it is personal. Again.',
    vagueRequest: 'the third one of that cop series, the cover is orange' },

  // --- Sci-Fi ---
  { id: 'simulation-question', title: 'The Simulation Question', genre: 'scifi', year: 1999, copies: 2, newRelease: true,
    tagline: 'What if the rain was never real?',
    vagueRequest: 'everybody wears sunglasses and gravity stops working' },
  { id: 'lizard-park', title: 'Lizard Park', genre: 'scifi', year: 1993, copies: 4,
    tagline: 'The gates open at dawn. Nobody planned for dusk.',
    vagueRequest: 'the dinosaur one, my kid has seen it eleven times' },
  { id: 'total-reminder', title: 'Total Reminder', genre: 'scifi', year: 1990, copies: 3,
    tagline: 'They sold him a vacation. They kept the receipt.',
    vagueRequest: 'the guy buys a fake memory and then Mars happens' },
  { id: 'men-in-beige', title: 'Men in Beige', genre: 'scifi', year: 1997, copies: 3,
    tagline: 'Government issue. Galaxy approved.',
    vagueRequest: 'two agents in suits, they zap your memory with a pen thing' },
  { id: 'astral-conflict', title: 'Astral Conflict', genre: 'scifi', year: 1992, copies: 2,
    tagline: 'A galaxy picks a side.',
    vagueRequest: 'space wizards, laser swords, the one everyone quotes' },

  // --- Horror ---
  { id: 'shriek', title: 'Shriek', genre: 'horror', year: 1996, copies: 4,
    tagline: 'The rules are simple. Nobody follows them.',
    vagueRequest: 'the teen slasher where the killer calls you on the phone first' },
  { id: 'the-videotape', title: 'The Videotape', genre: 'horror', year: 1999, copies: 2, newRelease: true,
    tagline: 'Seven days. One copy. Be kind.',
    vagueRequest: 'the cursed tape one, that is funny given where we are standing' },
  { id: 'thicket', title: 'Thicket: Found Footage', genre: 'horror', year: 1999, copies: 3, newRelease: true,
    tagline: 'They went in with three cameras. We got one back.',
    vagueRequest: 'the shaky woods one everybody says is real but is not' },
  { id: 'playtime-pal', title: 'Playtime Pal', genre: 'horror', year: 1991, copies: 2,
    tagline: 'Batteries not required.',
    vagueRequest: 'the evil doll, red hair, terrible attitude' },
  { id: 'lake-house-6', title: 'Lake House Massacre 6', genre: 'horror', year: 1995, copies: 5,
    tagline: 'Summer camp is back in session.',
    vagueRequest: 'anything with a machete and a canoe, does not matter which' },

  // --- Comedy ---
  { id: 'groundhog-tuesday', title: 'Groundhog Tuesday', genre: 'comedy', year: 1993, copies: 3,
    tagline: 'Same day. Same town. Same idiot.',
    vagueRequest: 'the one where the day keeps repeating forever' },
  { id: 'dim-and-dimmer', title: 'Dim & Dimmer', genre: 'comedy', year: 1994, copies: 4,
    tagline: 'Two friends. One brain cell. Coast to coast.',
    vagueRequest: 'two morons drive across the country, the haircuts are bad' },
  { id: 'reception-crashers', title: 'Reception Crashers', genre: 'comedy', year: 1998, copies: 3,
    tagline: 'Open bar. Fake names. Real trouble.',
    vagueRequest: 'the wedding one, they sneak in for free shrimp' },
  { id: 'secret-agent-swinger', title: 'Secret Agent Swinger', genre: 'comedy', year: 1997, copies: 4,
    tagline: 'Frozen in 1967. Thawed out and insufferable.',
    vagueRequest: 'the spy spoof with the teeth and the catchphrase' },
  { id: 'office-drone', title: 'Office Drone', genre: 'comedy', year: 1999, copies: 2, newRelease: true,
    tagline: 'Somebody has the memo. Nobody has the will.',
    vagueRequest: 'the cubicle one, they smash the printer at the end' },

  // --- Family ---
  { id: 'ogre-it', title: 'Ogre It!', genre: 'family', year: 1999, copies: 2, newRelease: true,
    tagline: 'The swamp has a homeowners association now.',
    vagueRequest: 'the green monster one, my daughter will not stop singing it' },
  { id: 'sky-pups', title: 'Sky Pups', genre: 'family', year: 1997, copies: 4,
    tagline: 'This golden retriever plays center field.',
    vagueRequest: 'the dog that plays sports, any of them, there are nine' },
  { id: 'home-by-myself', title: 'Home By Myself', genre: 'family', year: 1990, copies: 3,
    tagline: 'They forgot the kid. The kid forgot mercy.',
    vagueRequest: 'the Christmas one where the boy boobytraps the house' },
  { id: 'toy-tales', title: 'Toy Tales', genre: 'family', year: 1995, copies: 3,
    tagline: 'They move when you leave the room.',
    vagueRequest: 'the cartoon with the cowboy and the spaceman toy' },
  { id: 'mermaid-princess', title: 'The Mermaid Princess', genre: 'family', year: 1991, copies: 4,
    tagline: 'She traded her voice. She kept her nerve.',
    vagueRequest: 'the underwater cartoon with the crab who sings' },

  // --- Drama ---
  { id: 'stonehaven', title: 'The Stonehaven Redemption', genre: 'drama', year: 1994, copies: 3,
    tagline: 'Twenty years. One tunnel. No witnesses.',
    vagueRequest: 'the prison one that nobody rented but everyone loves now' },
  { id: 'bobby-lump', title: 'Bobby Lump', genre: 'drama', year: 1994, copies: 4,
    tagline: 'He ran. History followed.',
    vagueRequest: 'the guy on the bench with the chocolates, he runs a lot' },
  { id: 'the-unsinkable', title: 'The Unsinkable', genre: 'drama', year: 1997, copies: 5,
    tagline: 'Three hours. Two tapes. One boat.',
    vagueRequest: 'the big boat one, it is two tapes, my wife wants it again' },
  { id: 'voicemail-romance', title: "You've Got Voicemail", genre: 'drama', year: 1998, copies: 3,
    tagline: 'She hates him. Her answering machine disagrees.',
    vagueRequest: 'the cute one where they fall in love over messages' },
  { id: 'sleepless-cedar-rapids', title: 'Sleepless in Cedar Rapids', genre: 'drama', year: 1993, copies: 3,
    tagline: 'Two strangers. One radio call. Nine hundred miles.',
    vagueRequest: 'the sad widower one, the radio show, very romantic' },
]

export const byId = (id: string): Title | undefined => CATALOG.find((t) => t.id === id)
export const byGenre = (genre: Genre): Title[] => CATALOG.filter((t) => t.genre === genre)
export const newReleases = (): Title[] => CATALOG.filter((t) => t.newRelease === true)
