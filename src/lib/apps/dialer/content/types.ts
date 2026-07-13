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
};

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
