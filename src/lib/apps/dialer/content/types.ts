/**
 * Canon content — the authored fictional universe (area code 616, autumn
 * 1987). These modules are the source of truth: the client renders them
 * directly in LOCAL MODE, and a seed generator turns them into D1 rows so
 * canon and community share one store online (PRD, content spec).
 *
 * Text fields may use the terminal color markup ({Y}…{/}); user-generated
 * content never does (it is escaped on render). Author everything pre-wrapped
 * to 80 columns.
 */

export type CanonPost = {
	author: string;
	/** Era-formatted date, MM/DD/YY. */
	date: string;
	body: string;
};

export type CanonTopic = {
	/** Stable slug — seed rows and read-tracking key off it. */
	slug: string;
	title: string;
	posts: CanonPost[];
};

/** A message section within a system (General Chatter, The Grapevine, …). */
export type CanonSection = {
	slug: string;
	title: string;
	topics: CanonTopic[];
};

export type CanonFile = {
	name: string;
	uploader: string;
	date: string;
	body: string;
	/** Listed download count on a fresh board (the fiction was already busy). */
	downloads: number;
	/** Text kind; canon uploads are never images. Defaults to 'txt'. */
	kind?: 'txt' | 'md';
};

/**
 * The hidden elite area every real board kept out back. Reached by a code word
 * at the main menu (never a listed command), then a members-only gate that lets
 * anyone in — the warmth is the payoff, not the exclusivity. Static: no posting,
 * no uploads.
 */
export type CanonBackRoom = {
	/** Code word at the main menu, matched case-insensitively (e.g. WEATHER). */
	codeWord: string;
	/** The gate line ("MEMBERS ONLY. WHO SENT YOU?") — any answer opens it. */
	gate: string;
	/** Printed once past the gate. */
	welcome: string;
	files: CanonFile[];
};

/** A room in a door game: its description and where each listed exit leads. */
export type DoorRoom = {
	/** Screen text for the room, markup allowed. */
	body: string;
	/** Single-letter command → destination room index, or 'win' / 'die'. */
	exits: Record<string, number | 'win' | 'die'>;
};

/** A deliberately tiny text dungeon reached from [D] on the main menu. */
export type CanonDoor = {
	name: string;
	intro: string;
	rooms: DoorRoom[];
	/** Printed on reaching a 'win' exit; the caller's run posts to the board's scores. */
	win: string;
	/** Printed on a 'die' exit; no score. */
	death: string;
	/** Points banked for a win (the high-score table is real and server-side). */
	winScore: number;
};

/**
 * A login-gated secret system — not a BBS. Answers with bare carrier, takes a
 * credential, then shows a fixed set of static screens. PROJECT LODESTONE is
 * the only one; its payoff is atmosphere, so it's authored screen by screen.
 */
export type CanonSecret = {
	/** The one handle that logs in (canon-reserved). */
	loginHandle: string;
	/** The password buried on another board. */
	loginPassword: string;
	/** Menu key → screen text, markup allowed. */
	screens: { key: string; label: string; body: string }[];
	/** Handles already in VISITORS.LOG; the caller's is appended live. */
	visitorsSeed: string[];
	/** The line printed after the caller's handle is logged (the screenshot). */
	eventLine: string;
};

export type CanonSystem = {
	/** Locked server slug for public boards (src/lib/server/dialer/boards.ts). */
	id: string;
	/** Seven digits, no punctuation. */
	number: string;
	name: string;
	sysop: string;
	/** Full-screen welcome banner, markup allowed, ≤80 cols. */
	banner: string;
	sections: CanonSection[];
	files: CanonFile[];
	/**
	 * Public boards get a live server layer (real posts, presence, chat, the
	 * caller counter). Static systems (LODESTONE) render canon only. Defaults
	 * to false; the three PUBLIC_BOARDS set it true.
	 */
	live?: boolean;
	/**
	 * The sysop's canned answer to [Y]ell, printed after a believable delay
	 * (v1; the live LLM sysop is explicitly a fast-follow). Markup allowed.
	 */
	yell?: string;
	backRoom?: CanonBackRoom;
	door?: CanonDoor;
	/** Present only on the secret system: LODESTONE replaces the BBS flow entirely. */
	secret?: CanonSecret;
	/**
	 * The fastest rate the far modem trains at; dialing faster answers with
	 * carrier but never syncs (LODESTONE is 300-only — SCANLOG.TXT: "tried
	 * 1200, it won't train"). Absent means any rate trains.
	 */
	maxBaud?: 300 | 1200 | 2400 | 9600;
};

/** Can the far modem train at the caller's rate? */
export function trainsAt(system: CanonSystem, baud: number): boolean {
	return system.maxBaud === undefined || baud <= system.maxBaud;
}

/** A canon file's kind, defaulting text files to 'txt'. */
export function fileKind(file: CanonFile): 'txt' | 'md' {
	return file.kind ?? 'txt';
}

/** Format a raw seven-digit number the way screens print it: 555-2323. */
export function formatNumber(digits: string): string {
	return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/**
 * Format an epoch-seconds timestamp the way boards print dates: MM/DD/YY.
 * Canon post dates round-trip through the seed generator unchanged; real
 * callers' posts pick up today's date — which reads just as period-correct.
 */
export function formatEraDate(epochSeconds: number): string {
	const d = new Date(epochSeconds * 1000);
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
	return `${mm}/${dd}/${yy}`;
}
