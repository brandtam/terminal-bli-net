import type { CanonSystem } from './types';

/**
 * The Rusty Diskette BBS — 555-2323, the starter board on the sticky note.
 * Sysop: Captain Vector (Dale Kowalczyk, 41, XT clone in the garage, smells
 * of solder, signs everything "— CV"). Friendly, dad-joke energy, fiercely
 * proud of his 40 MB drive.
 *
 * Breadcrumb #1 lives in The Grapevine (Night Circuit's number); breadcrumb
 * #2 is the FOUNDRY.TXT ad in the file area.
 */
export const RUSTY_DISKETTE: CanonSystem = {
	id: 'rusty-diskette',
	number: '5552323',
	name: 'The Rusty Diskette',
	sysop: 'CAPT.VECTOR',
	banner: `{Y}
     ______________________________________________________________
    |                                                              |
    |   {*Y}THE RUSTY DISKETTE BBS{Y}                    [616] 555-2323   |
    |                                                              |
    |        {*W}"All the news that fits on a 40 MEGABYTE drive"{Y}       |
    |                                                              |
    |   SYSOP: CAPTAIN VECTOR         EST. 1985      2400/1200/300 |
    |______________________________________________________________|
{/}
Running RUSTBOARD v2.3 on a genuine XT clone. Be nice to her, she runs warm.
`,
	sections: [
		{
			slug: 'general',
			title: 'General Chatter',
			topics: [
				{
					slug: 'halloween-87',
					title: 'HALLOWEEN PLANS?',
					posts: [
						{
							author: 'CAPT.VECTOR',
							date: '10/09/87',
							body: `Two weeks out. The garage is getting the full treatment this year:
fog machine (borrowed), skeleton (paper), and the monitor graveyard
gets dragged onto the lawn. Six dead CRTs with candles inside.

The wife says it's a fire hazard. I say it's ATMOSPHERE.

Post your plans. Best costume idea gets 30 extra minutes of
board time. Judge's decision (mine) is final.

-- CV`
						},
						{
							author: 'PHRACTURE',
							date: '10/10/87',
							body: `going as a lineman. hard hat, tool belt, butt set on the hip.
nobody at the party will get it. that's the point.`
						},
						{
							author: 'CAPT.VECTOR',
							date: '10/10/87',
							body: `Phracture wins already and he doesn't even know what a costume
party is for. The 30 minutes are yours. Spend them wisely,
which for you means 3 AM. -- CV`
						}
					]
				},
				{
					slug: 'amiga-vs-st',
					title: 'AMIGA VS ST (ROUND 40)',
					posts: [
						{
							author: 'CAPT.VECTOR',
							date: '09/28/87',
							body: `I am REOPENING this topic because SOMEBODY (you know who you are)
filled up the last one arguing about custom chips until my poor
drive begged for mercy.

House rules this time:
1. No calling anyone's computer a "toy."
2. Numbers or it didn't happen.
3. When in doubt, remember my C64 in the corner is
   quietly beating you both on games per dollar.

-- CV`
						},
						{
							author: 'NO.CARRIER',
							date: '09/30/87',
							body: `the ST has MIDI ports on the back. standard. from the factory.
that is the whole post.`
						},
						{
							author: 'PHRACTURE',
							date: '10/01/87',
							body: `and the amiga has a blitter that makes the ST look like it's
drawing with a crayon held in its teeth. numbers: 4096 colors
vs 512. it didn't happen, per rule 2.`
						}
					]
				},
				{
					slug: 'back-room-joke',
					title: 'WHAT DOES CV KEEP IN THE BACK?',
					posts: [
						{
							author: 'NO.CARRIER',
							date: '10/02/87',
							body: `heard from a guy that CV keeps the good stuff in a members-only
area. best ANSI in the 616, secret files, the works. true?`
						},
						{
							author: 'CAPT.VECTOR',
							date: '10/03/87',
							body: `A gentleman never tells. But if you're curious, come find me at
the main menu and ask me about the WEATHER. We get some
interesting weather out here by the garage.

-- CV`
						}
					]
				}
			]
		},
		{
			slug: 'trade',
			title: 'Trade Post',
			topics: [
				{
					slug: 'wtb-1541',
					title: 'WTB: WORKING 1541',
					posts: [
						{
							author: 'PHRACTURE',
							date: '10/04/87',
							body: `wanted: one working 1541 drive. will trade two joysticks and a
slightly haunted C64. it types by itself sometimes. mostly the
letter J. otherwise a solid machine.`
						},
						{
							author: 'CAPT.VECTOR',
							date: '10/04/87',
							body: `Define "sometimes." I have a 1541 that reads every third disk
and a healthy respect for ghosts. This could be the worst trade
in board history and I am LISTENING. -- CV`
						}
					]
				},
				{
					slug: 'hayes-clone',
					title: 'FS: HAYES-COMPATIBLE 1200, $60',
					posts: [
						{
							author: 'NO.CARRIER',
							date: '10/07/87',
							body: `selling my old 1200 baud external. real hayes command set, not
the "mostly compatible" kind that hangs up when you sneeze.
$60 or best offer. upgrading to 2400 like a civilized person.`
						}
					]
				}
			]
		},
		{
			slug: 'grapevine',
			title: 'The Grapevine',
			topics: [
				{
					slug: 'night-circuit',
					title: 'WHERE THE NIGHT PEOPLE WENT',
					posts: [
						{
							author: 'PHRACTURE',
							date: '10/05/87',
							body: `you didn't hear this from me but the real late-night action moved
to {*C}NIGHT CIRCUIT{/}. mary runs a tight board. no games, no chatter,
just people who know things trading them after dark.

she only answers after 9 PM her time. {*W}555-8008{/}. tell her the
captain still owes her a crystal. she'll know what it means.`
						},
						{
							author: 'CAPT.VECTOR',
							date: '10/06/87',
							body: `For the record: it was ONE crystal, it was a 4.433 MHz, and I
mailed it back in a padded envelope like a gentleman.

Mary if you're reading this, the envelope was padded.

-- CV`
						}
					]
				},
				{
					slug: 'exchange-rumor',
					title: 'WEIRD NUMBERS IN THE EXCHANGE',
					posts: [
						{
							author: 'NO.CARRIER',
							date: '10/08/87',
							body: `guy at the surplus store swears there are carriers in the 555
exchange that don't belong to any board. no banner, no name,
just a login. probably nothing. probably test lines.

probably.`
						}
					]
				}
			]
		}
	],
	files: [
		{
			name: 'MODEM101.TXT',
			uploader: 'CAPT.VECTOR',
			date: '08/14/87',
			downloads: 212,
			body: `                       MODEM 101 -- by Captain Vector
                    "Everything I know about not connecting"

1. BUY HAYES COMPATIBLE. Not "works with most software." Not "custom
   command set, very fast." HAYES. COMPATIBLE. You will thank me at
   2 AM when your terminal program actually hangs up the phone.

2. 8-N-1. Eight data bits, no parity, one stop bit. If a board wants
   7-E-1 it will say so, loudly, and it is probably run by a bank.

3. That screech when you connect is the two modems agreeing on how
   fast to talk. It is called a handshake. It is supposed to sound
   like that. Stop calling me about it.

4. If the line drops every time your mother picks up the kitchen
   extension, that is not line noise. That is your mother.

5. Turn the modem speaker ON. Yes it's loud. It is also the only way
   to know whether you got a busy signal or a carrier before your
   software does. Information wants to be audible.

                                                        -- CV`
		},
		{
			name: 'ANSIDRAW.TXT',
			uploader: 'CAPT.VECTOR',
			date: '09/02/87',
			downloads: 87,
			body: `                    SO YOU WANT TO DRAW ANSI SCREENS

The Rusty Diskette accepts ANSI art submissions for the login screen.
Rotating gallery, full credit, immortality (local).

RULES OF THE HOUSE:
- 80 columns. Count them. I will count them.
- 16 colors is plenty. If it was good enough for the IBM engineers
  who chose them apparently at random, it is good enough for you.
- No screens that "blink the whole time." One blink element per
  screen, like a tasteful earring.
- Sign your work. Handles only.

Submissions to the file area, name it YOURHANDLE.ANS. Current champ
is SLAG from over at The Foundry, whose "molten pour" screen made a
grown sysop tear up a little. The bar is high.

                                                        -- CV`
		},
		{
			name: 'FOUNDRY.TXT',
			uploader: 'SLAG',
			date: '09/20/87',
			downloads: 149,
			body: `##########################################################
#                                                        #
#   T H E   F O U N D R Y                                #
#                                                        #
#   THIRD SHIFT BBS FOR PEOPLE WHO MAKE THINGS           #
#                                                        #
#   SHOP TALK - DEMO DEN - OLD IRON                      #
#                                                        #
#   NO SUITS NO HOMEWORK NO SPEED LIMIT                  #
#                                                        #
#   CALL 555-4477                                        #
#                                                        #
#   SYSOP: SLAG                                          #
#   IF ITS 3AM AND THE POUR IS DONE SHES PROBABLY ON     #
#                                                        #
##########################################################

posted with permission of the management (me) -- CV`
		}
	],
	yell: `{Y}The Captain wanders in from the garage, soldering iron in hand.{/}

{*Y}CV:{/} You rang? Make it quick, I've got a power supply on the bench
{*Y}CV:{/} in a very delicate mood. If it's about the ratio: upload
{*Y}CV:{/} something. If it's about the WEATHER: I have no idea what
{*Y}CV:{/} you're talking about. -- CV`,
	backRoom: {
		codeWord: 'WEATHER',
		gate: `THE BACK ROOM -- MEMBERS ONLY.

WHO SENT YOU?`,
		welcome: `{*Y}...checking the list... checking it twice... yep, there you are.{/}

WELCOME TO THE BACK ROOM. The good stuff, as promised.

House rule, and it's the only one: YOU'RE ONE OF US NOW.
DON'T POST THE WORD. -- CV`,
		files: [
			{
				name: 'SLAG.ANS',
				uploader: 'SLAG',
				date: '05/17/87',
				downloads: 12,
				body: `{R}
        ................................................
        :                                              :
        :        {*R}M O L T E N   P O U R{R}                 :
        :                                              :
        :              {*W}_________{R}                       :
        :              {*W}|       |{R}                       :
        :              {*W}| LADLE |{R}                       :
        :              {*W}|_______|{R}                       :
        :                 {*Y}| |{R}                          :
        :                 {*Y}| |{R}   {*Y}the pour{R}               :
        :                {*Y}.:::.{R}                         :
        :              {*Y}.:::::::.{R}                       :
        :            {W}_____________{R}                     :
        :                                              :
        :   {W}the screen that made a sysop cry.{R}          :
        :   {W}he knows who he is. -- SLAG{R}                :
        :                                              :
        ................................................
{/}`
			},
			{
				name: 'CRASHLOG.TXT',
				uploader: 'CAPT.VECTOR',
				date: '03/22/87',
				downloads: 31,
				body: `             THE NIGHT THE DRIVE DIED (AND CAME BACK)
                    as told by Captain Vector
              [BACK ROOM EXCLUSIVE. NOT FOR REPOST.]

March 14th, 11:52 PM. I'm closing up the garage and the Diskette
starts making a sound I can only describe as a coin in a blender.
The 40 MEGABYTE drive. My drive. The one I mention.

11:54, the sound stops. So does the drive. Dead. No spin, no
click, nothing. Three years of board history on that platter and
the last backup was -- I will be honest with this group and only
this group -- January.

I did everything wrong first. Power cycled it six times. Checked
the same cable twice. Said some things I won't repeat to a piece
of Seagate hardware like it could hear me. Nothing.

12:40 AM, I remember the old field trick: stiction. The heads
were stuck to the platter. The fix, and I swear this is real, is
PERCUSSIVE. You hold the drive flat, you give it one firm rotary
twist of the wrist, and you pray to whoever handles peripherals.

I stood in my garage at a quarter to one in the morning, holding
three years of this community over a workbench, and I TWISTED.

She spun up. First try. Every sector readable.

The drive has run warm and perfect ever since, the backups are
weekly now, and the wrist stays ready. That's the whole story.
The legend outside says I rebuilt the controller from scratch.
The Back Room gets the truth: your Captain fixed the board with
a flick of the wrist and has been dining out on it since March.

-- CV`
			},
			{
				name: 'CHILI.TXT',
				uploader: 'CAPT.VECTOR',
				date: '02/09/87',
				downloads: 27,
				body: `          CAPTAIN VECTOR'S FOUR-ALARM GARAGE CHILI
        second place, Otsego County Cook-Off, 1985 AND 1986
        (the judge both years was the same man. draw your own
         conclusions. i have drawn mine.)

YOU WILL NEED:
  2 lb chuck, cubed. not ground. we are not animals.
  1 lb hot italian sausage (the secret. now you know.)
  2 onions, 1 green pepper, 6 cloves garlic (yes, six)
  2 cans crushed tomatoes
  1 bottle dark beer (half for the pot)
  chili powder til your arm gets tired, then once more
  1 square baking chocolate (the OTHER secret. two secrets.)
  cumin, oregano, salt, cayenne to regret level

PROCEDURE:
  1. Brown the meat in batches. Crowd the pan and you'll steam
     it, and steamed meat is how you get third place.
  2. Onions, pepper, garlic in the fat. Don't rush them.
  3. Everything in the pot. Low heat. Lid cracked.
  4. Three hours minimum. Four is better. The board runs
     itself, go check the pot.
  5. The chocolate goes in at hour two. Tell nobody.

Serve with saltines and a cold one. Feeds six normal people or
three sysops. Do not enter it in Otsego County, that division
is rigged.

-- CV`
			}
		]
	},
	door: {
		name: 'GRIM CORRIDOR',
		intro: `{*W}G R I M   C O R R I D O R{/}
             a Rusty Diskette exclusive -- v1.1 -- by CV

You are a person of modest courage and one (1) torch, unlit.
Beneath the old grain elevator runs a corridor nobody walks
twice. The county records say it isn't there. The high-score
table says otherwise.
`,
		rooms: [
			{
				body: `{Y}== THE GRATE =={/}

A rusted grate hangs open over a stairway going down. Cold air
moves past you like it's leaving on purpose. Scratched into the
brick, in letters gone green: "IT DOESN'T LIKE THE LIGHT."

  [D]escend the stair`,
				exits: { D: 1 }
			},
			{
				body: `{Y}== THE LONG DARK =={/}

The stairs end in black. Somewhere ahead -- ten feet? forty? --
something is breathing. Slow. Patient. The kind of breathing
that has been down here a while and is in no hurry at all.

Your torch is still unlit. Your feet are still yours.

  [F]orward, quietly
  [T]orch -- strike it and light the thing`,
				exits: { F: 'die', T: 2 }
			},
			{
				body: `{Y}== THE LAIR =={/}

The torch catches and the dark jumps back. In the corner of a
round brick chamber crouches the CORRIDOR GRIM -- all shoulder
and no face, big as a furnace. It flinches from the flame and
lets out a sound like a drain unclogging in reverse.

It doesn't like the light. It is, however, between you and the
stairs on the far side. It watches the torch. Only the torch.

  [A]ttack it while it's cowering
  [S]lip along the wall, torch held high`,
				exits: { A: 'die', S: 'win' }
			}
		],
		win: `You keep the flame between you and it the whole way. It presses
itself into the brick and lets you pass -- and as your boot hits
the far stair, from the dark comes a low, wet sigh. Almost
grateful. Nobody has visited in a long, long time.

You surface behind the elevator with your torch, your boots, and
a story exactly nobody at the diner will believe.

{*Y}YOU HAVE SURVIVED THE GRIM CORRIDOR.{/}`,
		death: `The dark decides it is done being patient.

There is no pain. There is barely even a sound -- just the sense
of a very large drain, and you, and the fact that only one of
you is leaving. The county records are correct: there is nothing
down here at all.

{*R}YOU DIED IN THE GRIM CORRIDOR.{/}  (No score. The Grim keeps it.)`,
		winScore: 616
	},
	live: true
};
