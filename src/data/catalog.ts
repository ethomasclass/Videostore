export type Genre = 'action' | 'comedy' | 'horror' | 'scifi' | 'family' | 'drama'

export type Rating = 'G' | 'PG' | 'PG-13' | 'R'

export interface Title {
  id: string
  title: string
  genre: Genre
  year: number
  rating: Rating
  /** Minutes. Shown on the case, and the reason a few of these run to two tapes. */
  runtime: number
  /** Two invented stars. The same handful recur across the shelf, exactly as they used to. */
  starring: readonly [string, string]
  /** Back-of-box copy, read when the player pulls a case off the wall. */
  synopsis: string
  /** The line on the front of the sleeve. */
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
 * Every title is an original parody — evokes an era archetype without borrowing a real mark,
 * and every name in `starring` is invented. `vagueRequest` is the puzzle side: the customer
 * describes the movie, never names it.
 */
export const CATALOG: Title[] = [

  // --- Action ---
  {
    id: 'hard-to-perish',
    title: 'Hard to Perish',
    genre: 'action',
    year: 1994,
    rating: 'R',
    runtime: 126,
    starring: ['Chad Rockwell', 'Dale Vantrice'],
    tagline: 'He only came for the office party.',
    synopsis:
      'Off-duty patrolman Nick Barrone only wanted a cocktail and a conversation with his estranged wife. But when armed men seize the seventy-second floor and cut the phones, the party becomes a war — and Barrone is the only man inside, with no shoes, no backup and one clip. Pulse-pounding action from the first floor to the last. Merry Christmas, gentlemen.',
    vagueRequest: 'the one where the guy is barefoot in a skyscraper the whole time',
    copies: 4,
  },
  {
    id: 'velocity-bus',
    title: 'Velocity Bus',
    genre: 'action',
    year: 1995,
    rating: 'R',
    runtime: 116,
    starring: ['Chad Rockwell', 'Marla Devane'],
    tagline: 'Drop below fifty and the city goes up.',
    synopsis:
      'Bomb technician Ray Kessler has solved every puzzle a madman could build. Now there\'s a city bus wired to explode the instant it drops below fifty miles an hour — and a passenger named Dana at the wheel who has never driven anything bigger than a hatchback. Non-stop, white-knuckle suspense. Downtown is nine blocks away. The brakes are not an option.',
    vagueRequest: 'the bus one, it cannot slow down or it blows up',
    copies: 3,
  },
  {
    id: 'cliffdiver',
    title: 'Cliffdiver',
    genre: 'action',
    year: 1996,
    rating: 'R',
    runtime: 112,
    starring: ['Chad Rockwell', 'Gunnar Lemoyne'],
    tagline: 'No rope. No chance. No problem.',
    synopsis:
      'Haunted rescue climber Web Dolan hasn\'t touched the summit since the accident. But when a hijacked cargo plane scatters a briefcase of stolen currency across the peaks — and the thieves need a guide — Dolan is dragged back up the mountain at gunpoint. Edge-of-your-seat action at fourteen thousand feet. "You will never look down again." — Tri-County Sentinel.',
    vagueRequest: 'mountains, a briefcase of money, lots of falling',
    copies: 2,
  },
  {
    id: 'alcatraz-protocol',
    title: 'Alcatraz Protocol',
    genre: 'action',
    year: 1997,
    rating: 'R',
    runtime: 130,
    starring: ['Dale Vantrice', 'Sterling Vance Kroy'],
    tagline: 'The island nobody escapes. Twice.',
    synopsis:
      'A decorated general seizes a decommissioned island prison and aims a battery of chemical rockets at the mainland. The government has thirteen hours and exactly two men: a mild-mannered laboratory chemist who has never fired a weapon, and the only prisoner who ever broke out of that island alive. Riveting, explosive, relentless. One of them is lying about why he came back.',
    vagueRequest: 'the prison island one with the chemical rockets',
    copies: 3,
  },
  {
    id: 'maximum-vengeance-3',
    title: 'Maximum Vengeance 3',
    genre: 'action',
    year: 1998,
    rating: 'R',
    runtime: 118,
    starring: ['Chad Rockwell', 'Roxanne Mistral'],
    tagline: 'This time it is personal. Again.',
    synopsis:
      'Detective Sergeant Cole Maddox buried his partner in the first film and his brother in the second. Now the Zorich family has taken the one thing he had left, and Maddox turns in his badge for the third and final time. Non-stop vengeance. This time it is personal. Again. "Better than the other two put together." — Valley Film Report.',
    vagueRequest: 'the third one of that cop series, the cover is orange',
    copies: 5,
  },

  // --- Sci-Fi ---
  {
    id: 'simulation-question',
    title: 'The Simulation Question',
    genre: 'scifi',
    year: 1999,
    rating: 'R',
    runtime: 124,
    starring: ['Sterling Vance Kroy', 'Marla Devane'],
    tagline: 'What if the rain was never real?',
    synopsis:
      'By day Thomas Quill answers phones in a gray office tower. By night he searches the networks for a name that keeps appearing in his dreams. But when a woman in black tells him the rain outside his window was written by a machine, Quill must choose what is real — and fight an enemy wearing every face in the city. Mind-bending. Unforgettable.',
    vagueRequest: 'everybody wears sunglasses and gravity stops working',
    copies: 2,
    newRelease: true,
  },
  {
    id: 'lizard-park',
    title: 'Lizard Park',
    genre: 'scifi',
    year: 1993,
    rating: 'PG-13',
    runtime: 122,
    starring: ['Dale Vantrice', 'Marla Devane'],
    tagline: 'The gates open at dawn. Nobody planned for dusk.',
    synopsis:
      'A reclusive billionaire has built the greatest attraction on earth on a private island, and he\'s invited two scientists to bless it before opening day. The gates open at dawn to wonder beyond imagining. But when the power grid fails and the paddocks unlock, the guests become the exhibit. A pulse-pounding adventure for the entire family. Do not feed anything.',
    vagueRequest: 'the dinosaur one, my kid has seen it eleven times',
    copies: 4,
  },
  {
    id: 'total-reminder',
    title: 'Total Reminder',
    genre: 'scifi',
    year: 1990,
    rating: 'R',
    runtime: 113,
    starring: ['Chad Rockwell', 'Roxanne Mistral'],
    tagline: 'They sold him a vacation. They kept the receipt.',
    synopsis:
      'Construction worker Doug Quintero buys a budget vacation package straight to his memory — two weeks on Mars, no luggage. But when the procedure goes wrong, assassins he\'s never met start calling him by a name he\'s never used, and his own wife pulls a gun at the breakfast table. Who was he before they sold him himself? Non-stop science-fiction action.',
    vagueRequest: 'the guy buys a fake memory and then Mars happens',
    copies: 3,
  },
  {
    id: 'men-in-beige',
    title: 'Men in Beige',
    genre: 'scifi',
    year: 1997,
    rating: 'PG-13',
    runtime: 105,
    starring: ['Dale Vantrice', 'Lonnie Trask'],
    tagline: 'Government issue. Galaxy approved.',
    synopsis:
      'Agent Kessington has policed the galaxy\'s paperwork for forty years without a single citation. Now he\'s training a hotheaded city cop who can\'t stop asking questions — and there\'s a visitor in the tri-state area who doesn\'t intend to leave. Government issue. Galaxy approved. A hilarious, effects-packed thrill ride. "I laughed until I forgot everything." — Riverbend Weekly Picture Guide.',
    vagueRequest: 'two agents in suits, they zap your memory with a pen thing',
    copies: 3,
  },
  {
    id: 'astral-conflict',
    title: 'Astral Conflict',
    genre: 'scifi',
    year: 1992,
    rating: 'PG',
    runtime: 121,
    starring: ['Sterling Vance Kroy', 'Roxanne Mistral'],
    tagline: 'A galaxy picks a side.',
    synopsis:
      'On a dusty farming world, young Jareth Dunn dreams of the stars — until a message hidden in a broken droid drags him into a war a thousand years in the making. With a smuggler, a princess and an old wizard carrying a sword of light, he must strike the Imperium where it cannot be struck. Adventure on an epic scale.',
    vagueRequest: 'space wizards, laser swords, the one everyone quotes',
    copies: 2,
  },

  // --- Horror ---
  {
    id: 'shriek',
    title: 'Shriek',
    genre: 'horror',
    year: 1996,
    rating: 'R',
    runtime: 111,
    starring: ['Bitsy Callendar', 'Lonnie Trask'],
    tagline: 'The rules are simple. Nobody follows them.',
    synopsis:
      'Senior year in a quiet little town, and somebody is calling the girls of Cottonwood High before they die. Sidney Vayne knows the rules — never go upstairs, never say you\'ll be right back, never answer. But when the caller starts quoting her own alibi back to her, Sidney realizes the killer is on the guest list. Terrifying, clever, relentless.',
    vagueRequest: 'the teen slasher where the killer calls you on the phone first',
    copies: 4,
  },
  {
    id: 'the-videotape',
    title: 'The Videotape',
    genre: 'horror',
    year: 1999,
    rating: 'R',
    runtime: 109,
    starring: ['Bitsy Callendar', 'Marla Devane'],
    tagline: 'Seven days. One copy. Be kind.',
    synopsis:
      'Newspaper reporter Rachel Kerr investigates four teenagers who died the same night with the same expression on their faces. The only thing they shared was a cassette nobody remembers renting. Seven days after she watches it, the phone rings. One copy. One week. And Rachel\'s young son has already pressed play. "I slept with the lights on." — Northgate Press-Herald.',
    vagueRequest: 'the cursed tape one, that is funny given where we are standing',
    copies: 2,
    newRelease: true,
  },
  {
    id: 'thicket',
    title: 'Thicket: Found Footage',
    genre: 'horror',
    year: 1999,
    rating: 'R',
    runtime: 82,
    starring: ['Bitsy Callendar', 'Lonnie Trask'],
    tagline: 'They went in with three cameras. We got one back.',
    synopsis:
      'In October three student filmmakers hiked into the Wendham pines to document a local legend. They were never seen again. One year later their footage was recovered from beneath a rotting cabin floor — and it is presented here, unedited, exactly as found. There is no music. There is no rescue. This is not a story. "Deeply upsetting." — Coastal Independent Review.',
    vagueRequest: 'the shaky woods one everybody says is real but is not',
    copies: 3,
    newRelease: true,
  },
  {
    id: 'playtime-pal',
    title: 'Playtime Pal',
    genre: 'horror',
    year: 1991,
    rating: 'R',
    runtime: 88,
    starring: ['Roxanne Mistral', 'Lonnie Trask'],
    tagline: 'Batteries not required.',
    synopsis:
      'All little Andy Beckman wanted for his birthday was a Playtime Pal, the friendly talking doll every kid on the block is begging for. His mother found the last one in a back-alley shop for eleven dollars. Now the babysitter is dead, Andy is blamed, and nobody believes a toy can climb stairs. Batteries not required. Chilling, shocking, unforgettable.',
    vagueRequest: 'the evil doll, red hair, terrible attitude',
    copies: 2,
  },
  {
    id: 'lake-house-6',
    title: 'Lake House Massacre 6',
    genre: 'horror',
    year: 1995,
    rating: 'R',
    runtime: 92,
    starring: ['Bitsy Callendar', 'Gunnar Lemoyne'],
    tagline: 'Summer camp is back in session.',
    synopsis:
      'Five summers ago they burned him. Four summers ago they buried him at sea. Two summers ago they dropped him down the well — and the well is on the property. Now Camp Kewasquit reopens under new ownership, with eight fresh counselors, one very old groundskeeper, and a lake that never gave anything back. Summer camp is back in session. Nobody graduates.',
    vagueRequest: 'anything with a machete and a canoe, does not matter which',
    copies: 5,
  },

  // --- Comedy ---
  {
    id: 'groundhog-tuesday',
    title: 'Groundhog Tuesday',
    genre: 'comedy',
    year: 1993,
    rating: 'PG',
    runtime: 98,
    starring: ['Lonnie Trask', 'Marla Devane'],
    tagline: 'Same day. Same town. Same idiot.',
    synopsis:
      'Smug big-city weatherman Phil Corrigan is sent to cover a livestock festival in a town of nine hundred people, and he can\'t wait to leave. But when he wakes up to the same clock radio, the same slush puddle and the same insurance salesman for the eleventh straight morning, Phil must become a better man — or spend forever being this one. Heartwarming and hilarious.',
    vagueRequest: 'the one where the day keeps repeating forever',
    copies: 3,
  },
  {
    id: 'dim-and-dimmer',
    title: 'Dim & Dimmer',
    genre: 'comedy',
    year: 1994,
    rating: 'PG-13',
    runtime: 96,
    starring: ['Lonnie Trask', 'Wendell Pruitt Jr.'],
    tagline: 'Two friends. One brain cell. Coast to coast.',
    synopsis:
      'Limo driver Cass and dog groomer Duane share an apartment, a van and, between them, roughly one functioning thought. When a beautiful passenger leaves a briefcase behind, the boys set out across the country to return it — pursued by two men who would very much like it back. Coast to coast. Non-stop comedy. "I have not laughed harder all year." — Pinecrest Shopper.',
    vagueRequest: 'two morons drive across the country, the haircuts are bad',
    copies: 4,
  },
  {
    id: 'reception-crashers',
    title: 'Reception Crashers',
    genre: 'comedy',
    year: 1998,
    rating: 'R',
    runtime: 101,
    starring: ['Wendell Pruitt Jr.', 'Roxanne Mistral'],
    tagline: 'Open bar. Fake names. Real trouble.',
    synopsis:
      'Every June, Vince and Marty put on rented tuxedos and talk their way into strangers\' weddings — open bar, free cake, no last names. Nine summers, zero consequences. But when Vince actually falls for the bride\'s sister at the biggest reception of the season, the lies start colliding at the head table. Outrageous, hilarious, and surprisingly sweet. Never toast.',
    vagueRequest: 'the wedding one, they sneak in for free shrimp',
    copies: 3,
  },
  {
    id: 'secret-agent-swinger',
    title: 'Secret Agent Swinger',
    genre: 'comedy',
    year: 1997,
    rating: 'PG-13',
    runtime: 94,
    starring: ['Wendell Pruitt Jr.', 'Marla Devane'],
    tagline: 'Frozen in 1967. Thawed out and insufferable.',
    synopsis:
      'Britain\'s smoothest operative was frozen at the height of his powers in 1967. Thirty years later they thaw him out to stop his old nemesis — and nobody has the heart to tell him the sideburns are over. With a no-nonsense partner half his age, he must save the world without saying a single acceptable sentence. Groovy, baby. Hysterical from start to finish.',
    vagueRequest: 'the spy spoof with the teeth and the catchphrase',
    copies: 4,
  },
  {
    id: 'office-drone',
    title: 'Office Drone',
    genre: 'comedy',
    year: 1999,
    rating: 'R',
    runtime: 89,
    starring: ['Wendell Pruitt Jr.', 'Lonnie Trask'],
    tagline: 'Somebody has the memo. Nobody has the will.',
    synopsis:
      'Cubicle analyst Peter Renwick has filed the same form for six years. After a hypnotherapy session goes wrong, he simply stops caring — he stops attending meetings, stops answering to eight supervisors, and gets promoted. But when his two best friends are downsized, the three hatch a plan involving the payroll system and a decimal point. Somebody has the memo. Nobody has the will.',
    vagueRequest: 'the cubicle one, they smash the printer at the end',
    copies: 2,
    newRelease: true,
  },

  // --- Family ---
  {
    id: 'ogre-it',
    title: 'Ogre It!',
    genre: 'family',
    year: 1999,
    rating: 'PG',
    runtime: 89,
    starring: ['Wendell Pruitt Jr.', 'Bitsy Callendar'],
    tagline: 'The swamp has a homeowners association now.',
    synopsis:
      'Grunt the ogre wants exactly one thing: a quiet swamp. But when a pint-sized lord evicts every fairy-tale creature in the kingdom onto his front lawn, Grunt strikes a deal — rescue a princess from a dragon and get his mud back. With a motormouth donkey who will not stop talking, the grumpiest hero of the year saves the day. Fun for the whole family!',
    vagueRequest: 'the green monster one, my daughter will not stop singing it',
    copies: 2,
    newRelease: true,
  },
  {
    id: 'sky-pups',
    title: 'Sky Pups',
    genre: 'family',
    year: 1997,
    rating: 'G',
    runtime: 88,
    starring: ['Bitsy Callendar', 'Gunnar Lemoyne'],
    tagline: 'This golden retriever plays center field.',
    synopsis:
      'When shy new kid Toby Mullens finds a stray golden retriever behind the ballpark, he gains a best friend — and the worst team in town gains a center fielder who catches anything. But when a greedy former owner arrives with paperwork, Toby must prove a dog belongs to whoever loves him. Heartwarming family fun. Nothing in the rulebook says no.',
    vagueRequest: 'the dog that plays sports, any of them, there are nine',
    copies: 4,
  },
  {
    id: 'home-by-myself',
    title: 'Home By Myself',
    genre: 'family',
    year: 1990,
    rating: 'PG',
    runtime: 94,
    starring: ['Gunnar Lemoyne', 'Roxanne Mistral'],
    tagline: 'They forgot the kid. The kid forgot mercy.',
    synopsis:
      'Eight-year-old Skipper Hollis is the youngest of eleven, and nobody ever listens to him. So when the family flies to Florida without him, Skipper eats ice cream for dinner and watches whatever he wants. But two burglars have been watching the house — and Skipper has a basement full of paint cans and marbles. They picked the wrong house.',
    vagueRequest: 'the Christmas one where the boy boobytraps the house',
    copies: 3,
  },
  {
    id: 'toy-tales',
    title: 'Toy Tales',
    genre: 'family',
    year: 1995,
    rating: 'G',
    runtime: 79,
    starring: ['Lonnie Trask', 'Wendell Pruitt Jr.'],
    tagline: 'They move when you leave the room.',
    synopsis:
      'In the toy box under Casey\'s bed, a loyal old rag cowboy named Stitch has always been the favorite. But when a flashy space ranger arrives on Casey\'s birthday, convinced he is a genuine officer of the galaxy, the two rivals are knocked out the window and lost blocks from home. A magical adventure for the whole family.',
    vagueRequest: 'the cartoon with the cowboy and the spaceman toy',
    copies: 3,
  },
  {
    id: 'mermaid-princess',
    title: 'The Mermaid Princess',
    genre: 'family',
    year: 1991,
    rating: 'G',
    runtime: 76,
    starring: ['Bitsy Callendar', 'Sterling Vance Kroy'],
    tagline: 'She traded her voice. She kept her nerve.',
    synopsis:
      'Far beneath the waves, young Coralene collects lost treasures from the surface and dreams of walking on land. But when she trades her beautiful singing voice to a sea witch for three days with legs, she discovers that winning a prince is easy and telling the truth is not. Songs, wonder and laughter. She traded her voice. She kept her nerve. For all ages!',
    vagueRequest: 'the underwater cartoon with the crab who sings',
    copies: 4,
  },

  // --- Drama ---
  {
    id: 'stonehaven',
    title: 'The Stonehaven Redemption',
    genre: 'drama',
    year: 1994,
    rating: 'R',
    runtime: 138,
    starring: ['Sterling Vance Kroy', 'Dale Vantrice'],
    tagline: 'Twenty years. One tunnel. No witnesses.',
    synopsis:
      'Convicted of a murder he insists he did not commit, quiet banker Everett Lyle enters Stonehaven Penitentiary with nothing but a head for numbers. Over twenty years he rebuilds the prison library, cooks the warden\'s books, and befriends the man who can get anything — while, night after night, doing one small thing nobody notices. Deeply moving. "A masterpiece." — Fairview County Ledger.',
    vagueRequest: 'the prison one that nobody rented but everyone loves now',
    copies: 3,
  },
  {
    id: 'bobby-lump',
    title: 'Bobby Lump',
    genre: 'drama',
    year: 1994,
    rating: 'PG-13',
    runtime: 141,
    starring: ['Gunnar Lemoyne', 'Roxanne Mistral'],
    tagline: 'He ran. History followed.',
    synopsis:
      'Bobby Lump isn\'t a clever man, and he\'d be the first to say so. From a porch in rural Alabama he stumbles into three decades of American history — a war, a fortune, a shrimp boat and a president or two — always running, always waiting on the girl next door to come home. Funny, sweeping, and profoundly tender. He ran. History followed.',
    vagueRequest: 'the guy on the bench with the chocolates, he runs a lot',
    copies: 4,
  },
  {
    id: 'the-unsinkable',
    title: 'The Unsinkable',
    genre: 'drama',
    year: 1997,
    rating: 'PG-13',
    runtime: 187,
    starring: ['Sterling Vance Kroy', 'Marla Devane'],
    tagline: 'Three hours. Two tapes. One boat.',
    synopsis:
      'In 1912 a sheltered young heiress boards the largest vessel ever built, engaged to a man she cannot stand. In steerage, a penniless artist wins his ticket in a card game. Over four days they fall impossibly in love — and on the fifth night, the ocean decides. An epic romance of breathtaking scale. Three hours. Two tapes. Presented in its entirety.',
    vagueRequest: 'the big boat one, it is two tapes, my wife wants it again',
    copies: 5,
  },
  {
    id: 'voicemail-romance',
    title: 'You\'ve Got Voicemail',
    genre: 'drama',
    year: 1998,
    rating: 'PG',
    runtime: 103,
    starring: ['Marla Devane', 'Wendell Pruitt Jr.'],
    tagline: 'She hates him. Her answering machine disagrees.',
    synopsis:
      'Ellie Brandt runs the last little bookshop on Merchant Street. Gavin Pace is opening a warehouse store across the road and putting her out of business. They despise each other on sight. What neither knows is that the stranger each has been leaving long, honest messages for after midnight is sitting across the table. Charming, witty and romantic. Please leave a message.',
    vagueRequest: 'the cute one where they fall in love over messages',
    copies: 3,
  },
  {
    id: 'sleepless-cedar-rapids',
    title: 'Sleepless in Cedar Rapids',
    genre: 'drama',
    year: 1993,
    rating: 'PG',
    runtime: 102,
    starring: ['Marla Devane', 'Gunnar Lemoyne'],
    tagline: 'Two strangers. One radio call. Nine hundred miles.',
    synopsis:
      'Widowed architect Sam Tunnicliff hasn\'t slept properly in two years — until his eight-year-old son calls a late-night radio program and puts his father on the air. Nine hundred miles east, engaged newspaperwoman Annie Reece hears a stranger\'s voice and cannot let it go. Two strangers. One radio call. A warm, wonderful romance. "You will believe in second chances." — Lakeshore Bulletin.',
    vagueRequest: 'the sad widower one, the radio show, very romantic',
    copies: 3,
  },

]

export const byId = (id: string): Title | undefined => CATALOG.find((t) => t.id === id)
export const byGenre = (genre: Genre): Title[] => CATALOG.filter((t) => t.genre === genre)
export const newReleases = (): Title[] => CATALOG.filter((t) => t.newRelease === true)
