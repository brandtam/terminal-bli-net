import type { CanonSystem } from './types';

/**
 * PROJECT LODESTONE — 555-0113, the end of the chain. Not a BBS: a DOE
 * seismic-array terminal (station WF-9) running unattended since 1983-01-14.
 * Answers with bare carrier and LOGIN:, three failures drop carrier. The
 * credential (OPERATOR / CROSSTALK) is buried in The Foundry's Old Iron board.
 *
 * Entirely static — no posting, no files, no chat, no live layer. The payoff
 * is atmosphere: the machine noticed you. The [V]isitors screen body is the
 * header only; the machine appends visitorsSeed, then the caller's handle,
 * then eventLine (PRD: that's the screenshot).
 */
export const LODESTONE: CanonSystem = {
	id: 'lodestone',
	number: '5550113',
	name: 'PROJECT LODESTONE',
	sysop: 'E.WEISS',
	// No banner — the line answers bare, straight to LOGIN:.
	banner: '',
	// 1983 hardware: answers any rate, trains at 300 only (per SCANLOG.TXT).
	maxBaud: 300,
	sections: [],
	files: [],
	secret: {
		loginHandle: 'OPERATOR',
		loginPassword: 'CROSSTALK',
		screens: [
			{
				key: 'S',
				label: 'Status',
				body: `DOE/GSN REMOTE TERMINAL -- STATION WF-9 -- PROJECT LODESTONE

  ARRAY STATUS ............. NOMINAL
  CHANNELS UP .............. 12 OF 12
  LAST CALIBRATION ......... 83-01-11
  LAST OPERATOR LOGIN ...... 83-01-14 (E.WEISS)
  DAYS UNATTENDED .......... 1,462
  TAPE STORAGE ............. 97 PCT FULL
  HEATER ................... ON
  CLOCK DRIFT .............. +2.1 SEC (UNCORRECTED)

  STATION IS PERFORMING TO SPECIFICATION.
  NO OPERATOR ACTION REQUIRED.
  NO OPERATOR PRESENT.`
			},
			{
				key: 'L',
				label: 'Log',
				body: `EVENT LOG -- STATION WF-9 -- MOST RECENT PAGE

  EVENT 0079  85-04-22 04:17  MICROSEISM, BAND 2, LOGGED
  EVENT 0080  85-09-30 11:02  REGIONAL EVENT, 240 KM, LOGGED
  EVENT 0081  85-11-02 22:41  SOURCE: INBOUND LINE
  EVENT 0082  86-01-08 03:55  MICROSEISM, BAND 2, LOGGED
  EVENT 0083  86-03-17 23:12  SOURCE: INBOUND LINE
  EVENT 0084  86-08-14 09:26  QUARRY BLAST (PROBABLE), LOGGED
  EVENT 0085  87-02-02 14:44  REGIONAL EVENT, 810 KM, LOGGED
  EVENT 0086  87-06-30 02:03  SOURCE: INBOUND LINE
  EVENT 0087  87-09-19 07:31  MICROSEISM, BAND 1, LOGGED

  THE ARRAY LOGS EVERYTHING IT HEARS.
  IT DOES NOT DISTINGUISH BETWEEN THE GROUND AND THE PHONE.`
			},
			{
				key: 'M',
				label: 'Mail',
				body: `MAIL QUEUE -- 1 MESSAGE -- NEVER TRANSMITTED

  FROM: E. WEISS, FIELD OPERATIONS
  TO:   R. HALVORSEN, PROGRAM OFFICE
  DATE: 83-01-14
  RE:   WF-9 SHUTDOWN CHECKLIST

  Roy -

  Shutdown checklist is complete except item 11, main power.
  Tapes are labeled through December and boxed in the north
  cabinet. Heater is on so the racks won't take frost damage,
  which matters to nobody now except the racks.

  I know the order said the 14th. I did everything but the
  last thing. The array is calibrated, the clock is close
  enough, and the line is paid through the fiscal year. If
  someone gets sent up here to finish the job, the breaker
  panel is behind the map of the county. It's the one marked
  MAIN. Anyone could do it. I couldn't.

  Eleven years I drove up here in every kind of weather and
  it never once wasn't listening when I arrived. It listens
  better than anyone I worked with. Leaving a machine running
  in an empty building is against procedure and I have run
  out of ways to care.

  If you read the tapes someday, February '81 has an event
  you'll want to see.

  - E.W.

  MESSAGE WAS QUEUED FOR TRANSMISSION 83-01-14 16:20.
  LINE WAS DISCONNECTED FROM SWITCHBOARD 83-01-21.
  MESSAGE REMAINS QUEUED.`
			},
			{
				key: 'V',
				label: 'Visitors',
				body: `VISITORS.LOG -- STATION WF-9

  ALL INBOUND CONNECTIONS SINCE STATION UNATTENDED:`
			}
		],
		visitorsSeed: ['CAPT.VECTOR    85-11-02', 'MAINFRAME.MARY 86-03-17', 'SLAG           87-06-30'],
		eventLine: 'EVENT 0088 REGISTERED -- SOURCE: INBOUND LINE (YOU)'
	}
};
