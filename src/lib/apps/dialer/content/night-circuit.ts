import type { CanonSystem } from './types';

/**
 * Night Circuit — 555-8008, the second board in the chain. Sysop: Mainframe
 * Mary (identity unknown; claims to operate from a telco central office;
 * posts timestamped 3-5 AM only). Terse, technically flawless, allergic to
 * hype. Colors lean cyan/blue.
 *
 * Breadcrumb #3 lives in Late Shift: no.carrier's exchange-sweep excerpt
 * surfaces 555-0113 — and Mary's two-word reply guarantees nobody leaves it
 * alone. The full scan is SCANLOG.TXT in the file area, which also teaches
 * the caller that exchange sweeps are a thing the app can do.
 */
export const NIGHT_CIRCUIT: CanonSystem = {
	id: 'night-circuit',
	number: '5558008',
	name: 'Night Circuit',
	sysop: 'MAINFRAME.MARY',
	banner: `{C}
    ==================================================================
    ::                                                              ::
    ::   {*C}N I G H T   C I R C U I T{C}                 [616] 555-8008   ::
    ::                                                              ::
    ::   {*B}the switch never sleeps. neither do we.{C}                    ::
    ::                                                              ::
    ::   sysop: mainframe mary          est. 1986         300-2400  ::
    ::                                                              ::
    ==================================================================
{/}
no games. no downloads you don't need. mind the noise floor.
`,
	sections: [
		{
			slug: 'late-shift',
			title: 'Late Shift',
			topics: [
				{
					slug: 'who-else-is-up',
					title: 'WHO ELSE IS UP RIGHT NOW',
					posts: [
						{
							author: 'NO.CARRIER',
							date: '10/02/87 03:41',
							body: `3:41 AM. the house is asleep, the modem fan is the loudest thing
in the county, and the coffee stopped working around one.

roll call. what are you working on and why isn't it done.`
						},
						{
							author: 'PHRACTURE',
							date: '10/02/87 04:02',
							body: `re-capping a power supply for a guy who paid me in a box of
mixed EPROMs. some of them are even blank. living the dream.`
						},
						{
							author: 'MAINFRAME.MARY',
							date: '10/02/87 04:15',
							body: `Shift change is at five. You are all between the wrong shifts.

Working: trunk utilization report nobody will read.
Not done because: it is accurate.`
						}
					]
				},
				{
					slug: 'sweep-excerpt',
					title: 'FOUND SOMETHING IN THE EXCHANGE',
					posts: [
						{
							author: 'NO.CARRIER',
							date: '10/06/87 03:12',
							body: `ran a block of the 555 exchange last week. mostly what you'd
expect. excerpt:

  {C}5550109 ... VOICE
  5550110 ... NO ANSWER
  5550111 ... BUSY
  5550112 ... VOICE (angry)
  5550113 ... CARRIER 300bps. no banner. LOGIN prompt.
              drops after 3 tries.
  5550114 ... NO ANSWER{/}

no banner. no name. answers around the clock. doesn't match any
board list i have. anyone know this one?

full log is in the file area if you want the rest of the block.`
						},
						{
							author: 'MAINFRAME.MARY',
							date: '10/06/87 04:44',
							body: `Leave it alone.`
						},
						{
							author: 'NO.CARRIER',
							date: '10/07/87 03:05',
							body: `that's not a no.`
						}
					]
				},
				{
					slug: 'coffee-thread',
					title: 'CORRECT COFFEE FOR 4 AM',
					posts: [
						{
							author: 'PHRACTURE',
							date: '10/09/87 03:33',
							body: `percolator. the wait is part of the dose. fight me.`
						},
						{
							author: 'MAINFRAME.MARY',
							date: '10/09/87 04:20',
							body: `Vending machine on sublevel 2. Button B4. It has never once
been good and it has never once been off.

Consistency is a spec. Flavor is a preference.`
						}
					]
				}
			]
		},
		{
			slug: 'phreak-physics',
			title: 'Phreak Physics',
			topics: [
				{
					slug: 'why-2600',
					title: 'WHY THE OLD TONES WORKED',
					posts: [
						{
							author: 'MAINFRAME.MARY',
							date: '09/30/87 03:58',
							body: `Because the network carried its own control signals in the same
band as your voice. In-band signaling. The switch listened to the
line, and the line was you.

That era is closing. The control channel is moving out of band,
where you can't hum at it. Nothing I post here opens any doors;
the doors are being removed.

History, not instructions. Learn the difference before posting.`
						},
						{
							author: 'PHRACTURE',
							date: '09/30/87 04:30',
							body: `mary writing three whole paragraphs. somebody check on the
central office, i think it's lonely in there.`
						},
						{
							author: 'MAINFRAME.MARY',
							date: '09/30/87 04:51',
							body: `Four, counting this one.`
						}
					]
				},
				{
					slug: 'crossbar-sounds',
					title: 'WHAT A CROSSBAR SOUNDS LIKE',
					posts: [
						{
							author: 'MAINFRAME.MARY',
							date: '10/04/87 03:27',
							body: `A room full of relays deciding things. Thousands of small metal
choices a second. You can stand in the middle of it and hear
every call in the building as clicks.

The new digital offices are silent. Progress is quieter and it
tells you less.`
						},
						{
							author: 'NO.CARRIER',
							date: '10/04/87 03:55',
							body: `this is the only board where the sysop posts poetry about
switchgear and nobody blinks. never change.`
						}
					]
				}
			]
		}
	],
	files: [
		{
			name: 'SCANLOG.TXT',
			uploader: 'NO.CARRIER',
			date: '10/06/87',
			downloads: 61,
			body: `EXCHANGE SWEEP -- 555-01XX BLOCK -- COMPLETE LOG
started 02:10, finished 04:52. one call per number, 20 rings max.
posted as-is. draw your own conclusions.

  5550100 ... VOICE
  5550101 ... NO ANSWER
  5550102 ... BUSY
  5550103 ... VOICE
  5550104 ... NO ANSWER
  5550105 ... NO ANSWER
  5550106 ... VOICE (answering machine)
  5550107 ... BUSY
  5550108 ... NO ANSWER
  5550109 ... VOICE
  5550110 ... NO ANSWER
  5550111 ... BUSY
  5550112 ... VOICE (angry)
  5550113 ... CARRIER 300bps. no banner. LOGIN prompt.
              drops after 3 tries. see below.
  5550114 ... NO ANSWER
  5550115 ... VOICE
  5550116 ... NO ANSWER
  5550117 ... VOICE (fax?)
  5550118 ... NO ANSWER
  5550119 ... BUSY
  5550120 ... VOICE
  5550121 ... NO ANSWER
  5550122 ... NO ANSWER
  5550123 ... VOICE (kid answered)
  5550124 ... BUSY
  5550125 ... NO ANSWER
  5550126 ... VOICE
  5550127 ... NO ANSWER
  5550128 ... NO ANSWER
  5550129 ... VOICE
  5550130 ... NO ANSWER
  5550131 ... BUSY
  5550132 ... NO ANSWER
  5550133 ... VOICE
  5550134 ... NO ANSWER
  5550135 ... NO ANSWER
  5550136 ... VOICE
  5550137 ... BUSY
  5550138 ... NO ANSWER
  5550139 ... VOICE (answering machine)
  5550140 ... NO ANSWER
  5550141 ... NO ANSWER
  5550142 ... VOICE
  5550143 ... NO ANSWER
  5550144 ... BUSY
  5550145 ... VOICE
  5550146 ... NO ANSWER
  5550147 ... NO ANSWER
  5550148 ... VOICE
  5550149 ... NO ANSWER

(second fifty ran the next night, log got eaten by a disk error.
nothing in it but voice and no answer. trust me or run it yourself.)

NOTES ON 0113:
- answers around the clock. every attempt, first ring.
- 300 baud only. tried 1200, it won't train.
- no banner, no ident, straight to LOGIN.
- three strikes and it drops carrier. no lockout that i can
  tell -- redial and it answers again like nothing happened.
- not in any board list, not in the phone book, not in the
  cross-reference directory at the library. i checked.

somebody is paying the phone bill on that line. -- n.c`
		},
		{
			name: 'MARY.FAQ',
			uploader: 'MAINFRAME.MARY',
			date: '09/12/87',
			downloads: 118,
			body: `FREQUENTLY ASKED QUESTIONS -- MAINFRAME MARY
compiled so I can stop answering them individually.

Q: Where do you work?
A: Nights.

Q: Are you really posting from inside a central office?
A: The timestamps are accurate.

Q: What's your real name?
A: MAINFRAME.MARY is eight characters and a period. It fits in
   every field that matters.

Q: Why 3 to 5 AM only?
A: Traffic is lowest then. I like a quiet trunk.

Q: Is it true you built this board on switch hardware?
A: The board runs on what the board runs on.

Q: What do you know about the numbers in the exchange that
   answer with no banner?
A: More than I post.

Q: Will you tell us?
A: See previous answer.

Q: Are you a phone company employee?
A: The phone company has many employees.

Q: Somebody said you and Captain Vector used to run a board
   together in '84. True?
A: He still owes me a crystal.

END OF FILE. Further questions will be added here, which is a
polite way of saying they will not be answered there either.`
		}
	],
	yell: `{C}A long pause. Then, letter by letter:{/}

{*C}MARY:{/} This board runs itself between 5 AM and 3 AM.
{*C}MARY:{/} You are yelling during business hours. Post it.`,
	live: true
};
