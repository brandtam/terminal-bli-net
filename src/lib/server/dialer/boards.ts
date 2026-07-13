/**
 * The public boards — the only ones that get a DialerBoardNode (live presence,
 * node chat, caller counter). PROJECT LODESTONE and the Back Room are static
 * canon spaces and deliberately have no live layer. The slugs double as the
 * `board` column value in D1 and the DO instance name (`idFromName(board)`).
 */
export const PUBLIC_BOARDS = ['rusty-diskette', 'night-circuit', 'foundry'] as const;

export type PublicBoard = (typeof PUBLIC_BOARDS)[number];

export function isPublicBoard(value: string): value is PublicBoard {
	return (PUBLIC_BOARDS as readonly string[]).includes(value);
}

/** A board answers BUSY once this many callers are connected (real occupancy). */
export const BOARD_MAX_CALLERS = 8;
