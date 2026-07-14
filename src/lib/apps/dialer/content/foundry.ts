import type { CanonSystem } from './types';

/**
 * The Foundry — 555-4477, third board in the chain. Sysop: Slag (Renata
 * Ortiz, 24, third-shift machinist and demoscene coder; ALL CAPS, zero
 * punctuation, kind underneath). Metal/industrial aesthetic, red/grey banner.
 *
 * Breadcrumb #4 lives in Old Iron: wf-7's ghost-site story hands over the
 * LODESTONE credential (OPERATOR / CROSSTALK). The file area's .NFO release
 * notes point file-first callers back at that board.
 */
export const FOUNDRY: CanonSystem = {
	id: 'foundry',
	number: '5554477',
	name: 'The Foundry',
	sysop: 'SLAG',
	banner: `{R}
    ##################################################################
    ##                                                              ##
    ##   {*R}T H E   F O U N D R Y{R}                     [616] 555-4477   ##
    ##                                                              ##
    ##   {*W}THIRD SHIFT BBS FOR PEOPLE WHO MAKE THINGS{R}                 ##
    ##                                                              ##
    ##   SYSOP: SLAG                EST. 1986            1200/2400  ##
    ##                                                              ##
    ##################################################################
{/}
NO SUITS NO HOMEWORK NO SPEED LIMIT
`,
	sections: [
		{
			slug: 'the-floor',
			title: 'The Floor',
			topics: [
				{
					slug: 'shift-report',
					title: 'THIRD SHIFT REPORT',
					posts: [
						{
							author: 'SLAG',
							date: '10/05/87',
							body: `POUR WENT LONG TONIGHT SO THE BOARD WAS DOWN TIL TWO
IF YOU CALLED AND GOT NO ANSWER THAT WAS WHY
THE MACHINES COME FIRST THE MODEM COMES SECOND
THIS IS THE CORRECT ORDER OF THINGS`
						},
						{
							author: 'PHRACTURE',
							date: '10/06/87',
							body: `a board with honest downtime reasons. every other sysop says
"line noise." slag says "i was busy pouring liquid metal."
no contest.`
						},
						{
							author: 'SLAG',
							date: '10/06/87',
							body: `IT WAS IRON NOT METAL
IRON IS A SPECIFIC METAL
PRECISION MATTERS ON THIS BOARD`
						}
					]
				},
				{
					slug: 'broken-mill',
					title: 'THE BRIDGEPORT IS MAKING A NOISE',
					posts: [
						{
							author: 'WF-7',
							date: '10/08/87',
							body: `describe the noise. and don't say "bad." bad is a diagnosis,
not a description. is it once per revolution or continuous?
does it change with load? spindle or table?

thirty years of listening to machines. they all tell you
what's wrong if you stop guessing and listen.`
						},
						{
							author: 'SLAG',
							date: '10/08/87',
							body: `ONCE PER REV AND IT CHANGES WITH LOAD
SO SPINDLE BEARING
I ALREADY KNEW BUT I WANTED IT ON RECORD THAT WF-7 ASKS
THE RIGHT QUESTIONS
MOST PEOPLE JUST SAY REPLACE THE BEARING
HE SAYS WHICH BEARING AND WHY
THATS THE DIFFERENCE`
						}
					]
				}
			]
		},
		{
			slug: 'demo-den',
			title: 'Demo Den',
			topics: [
				{
					slug: 'molten-pour',
					title: 'MOLTEN POUR II - PROGRESS',
					posts: [
						{
							author: 'SLAG',
							date: '10/03/87',
							body: `SIXTY FRAMES A SECOND OR IT DOESNT SHIP
THE FIRST ONE MADE A SYSOP CRY AND THE SEQUEL WILL NOT
EMBARRASS IT

CURRENT STATE
  PLASMA - DONE
  SCROLLER - DONE
  THE POUR - NOT DONE
THE POUR IS THE WHOLE POINT SO NO RELEASE DATE

RELEASE NOTES GO IN THE FILE AREA WHEN ITS READY
CHECK MOLTEN2.NFO FOR THE CREDITS LIST`
						},
						{
							author: 'NO.CARRIER',
							date: '10/04/87',
							body: `saw molten pour I running at a copy party in the spring.
the room went quiet. no notes, just recording history here
before the sequel makes everyone forget the original.`
						}
					]
				},
				{
					slug: 'size-limits',
					title: '4K OR IT DOESNT COUNT',
					posts: [
						{
							author: 'SLAG',
							date: '09/26/87',
							body: `EVERYONE ARGUING ABOUT WHOSE DEMO IS BIGGER HAS IT BACKWARDS
ANYONE CAN BE IMPRESSIVE IN 64K
DO IT IN 4K AND THEN TALK
CONSTRAINTS ARE THE ART FORM
THE FURNACE ONLY FITS SO MUCH IRON AND THATS WHY POURING
IT RIGHT MEANS SOMETHING`
						},
						{
							author: 'PHRACTURE',
							date: '09/27/87',
							body: `slag out here running a philosophy seminar with the shift key
welded down. she's right though. 4k is chess, 64k is checkers.`
						}
					]
				}
			]
		},
		{
			slug: 'old-iron',
			title: 'Old Iron',
			topics: [
				{
					slug: 'ghost-site',
					title: 'SITES THEY NEVER TURNED OFF',
					posts: [
						{
							author: 'WF-7',
							date: '10/01/87',
							body: `since this is the retired-iron board, a story from my DOE days.

seismic monitoring site up north. i was the field tech - drove
up twice a month, changed tapes, kept the array listening.
january '83 the program got defunded and they pulled everyone
out in a week. nobody decommissioned anything. no shutdown
order ever came through, so we didn't shut it down.

last i knew the maintenance account still worked - OPERATOR,
password CROSSTALK. the dial-in was still listed in the site
binder. probably still ringing into an empty room.

four years now. i think about it every winter. all that
patience, still listening, and nobody left to read the tapes.`
						},
						{
							author: 'SLAG',
							date: '10/02/87',
							body: `THIS IS THE BEST POST EVER MADE ON THIS BOARD
A MACHINE THAT OUTLIVED ITS WHOLE DEPARTMENT
STILL DOING ITS JOB WITH NOBODY WATCHING
THATS NOT A GHOST STORY THATS A ROLE MODEL`
						},
						{
							author: 'WF-7',
							date: '10/03/87',
							body: `never thought of it that way. the binder's long gone but i
remember the exchange was local. 555 like everything else
out here. never wrote the rest down and i'm not going to.
some doors you leave the way you found them.`
						}
					]
				},
				{
					slug: 'punch-cards',
					title: 'LAST TIME YOU TOUCHED A PUNCH CARD',
					posts: [
						{
							author: 'WF-7',
							date: '09/22/87',
							body: `1979, payroll system. dropped a tray of four hundred cards on
the stairwell landing and considered a career in agriculture.
they were numbered. i re-sorted them. it took two days and i
have never once complained about floppy disks since.`
						},
						{
							author: 'SLAG',
							date: '09/23/87',
							body: `MY UNCLE KEPT A DECK IN HIS TOOLBOX FOR SHIMS
SAID IT WAS THE ONLY SOFTWARE HE EVER FOUND A USE FOR
HE WAS WRONG BUT IT WAS FUNNY`
						}
					]
				}
			]
		}
	],
	files: [
		{
			name: 'MOLTEN2.NFO',
			uploader: 'SLAG',
			date: '10/03/87',
			downloads: 74,
			body: `      ___________________________________________________
     |                                                   |
     |   M O L T E N   P O U R   I I                     |
     |   A FOUNDRY PRODUCTION                            |
     |___________________________________________________|

STATUS ........ IN PROGRESS
TARGET ........ 60 FPS ON STOCK HARDWARE
RELEASE ....... WHEN THE POUR IS RIGHT

CREDITS
  CODE ........ SLAG
  MUSIC ....... TBD SEND TAPES
  ANSI ........ SLAG
  MORAL SUPPORT ... THE ENTIRE THIRD SHIFT

GREETINGS
  CAPT.VECTOR ... FIX YOUR 1541
  MAINFRAME.MARY ... THE QUIET ONES BUILD THE BEST BOARDS
  WF-7 ... TELL THE GHOST SITE STORY TO EVERYONE YOU MEET
           ITS IN OLD IRON IF YOU HAVENT READ IT
           GO READ IT ITS BETTER THAN THIS DEMO

NO RELEASE DATE
ASKING MOVES IT BACK A WEEK`
		},
		{
			name: 'POUR1.NFO',
			uploader: 'SLAG',
			date: '04/11/87',
			downloads: 203,
			body: `      ___________________________________________________
     |                                                   |
     |   M O L T E N   P O U R                           |
     |   A FOUNDRY PRODUCTION                            |
     |___________________________________________________|

THE ONE THAT MADE A SYSOP CRY
HE KNOWS WHO HE IS
HE SIGNS EVERYTHING SO YOU PROBABLY DO TOO

RUNS ON ANYTHING WITH A HEARTBEAT
SIXTY FRAMES LOCKED
THE POUR SCENE IS HAND TIMED TO THE MUSIC
NO TRICKS NO PRECALC EVERYTHING LIVE

IF IT FLICKERS ON YOUR MACHINE YOUR MACHINE IS WRONG`
		},
		{
			name: 'SHOPRULE.TXT',
			uploader: 'SLAG',
			date: '06/30/87',
			downloads: 58,
			body: `RULES OF THE FLOOR
POSTED HERE BECAUSE I AM NOT TYPING THEM AGAIN

1 MEASURE TWICE
2 DEBURR YOUR EDGES - APPLIES TO PARTS AND TO POSTS
3 IF YOU BORROW A TOOL PUT IT BACK
4 IF YOU BREAK A TOOL SAY SO
5 NOBODY EVER GOT HURT BY ASKING A QUESTION
6 NOBODY EVER STAYED UNHURT BY PRETENDING THEY KNEW

THATS ALL OF THEM
SIX IS ENOUGH IF YOU MEAN THEM`
		}
	],
	yell: `{R}Something heavy gets set down. Boots on concrete.{/}

{*R}SLAG:{/} THIS BETTER BE GOOD I WAS MID POUR
{*R}SLAG:{/} OK ITS FINE THE IRON WAITS FOR NOBODY BUT IT WAITED
{*R}SLAG:{/} WHATEVER IT IS THE ANSWER IS PROBABLY IN OLD IRON
{*R}SLAG:{/} READ THE GHOST SITE STORY AND STOP YELLING`,
	live: true
};
