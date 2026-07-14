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

/**
 * Message sections per public board (PRD content spec). Section slugs live in
 * the `topics.section` column; posting validates against this list so the API
 * can't grow junk sections. The client content modules bind to the same slugs
 * (seed generator + LOCAL MODE rendering) — a guard test keeps them aligned.
 */
export const BOARD_SECTIONS: Record<PublicBoard, readonly string[]> = {
	'rusty-diskette': ['general', 'trade', 'grapevine'],
	'night-circuit': ['late-shift', 'phreak-physics'],
	foundry: ['the-floor', 'demo-den', 'old-iron']
};

/** A board answers BUSY once this many callers are connected (real occupancy). */
export const BOARD_MAX_CALLERS = 8;

/** Daily connect-time budget in minutes (PRD "rate limits as fiction"). */
export const DAILY_MINUTES_BUDGET = 45;

/** Remaining-minute marks that earn an in-fiction warning line. */
export const TIME_WARNINGS = [10, 1] as const;
