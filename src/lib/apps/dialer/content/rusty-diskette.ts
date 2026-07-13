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
	]
};
