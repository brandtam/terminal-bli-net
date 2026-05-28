import type { Episode, ShowInput } from './types';

function escapeSingleQuoted(s: string): string {
	return String(s)
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r');
}

function emitEpisode(ep: Episode, isLast: boolean): string[] {
	const lines = [
		'\t\t\t{',
		`\t\t\t\tid: '${escapeSingleQuoted(ep.id)}',`,
		`\t\t\t\ttitle: '${escapeSingleQuoted(ep.title)}',`,
		`\t\t\t\tyear: ${Number.isFinite(ep.year) ? ep.year : 0},`,
		`\t\t\t\tarchiveId: '${escapeSingleQuoted(ep.archiveId)}',`
	];
	if (ep.archiveFile) {
		lines.push(`\t\t\t\tarchiveFile: '${escapeSingleQuoted(ep.archiveFile)}',`);
	}
	lines.push(`\t\t\t\tdescription:`);
	lines.push(`\t\t\t\t\t'${escapeSingleQuoted(ep.description)}'`);
	lines.push(isLast ? '\t\t\t}' : '\t\t\t},');
	return lines;
}

export class ShowBlockNotFoundError extends Error {
	constructor(id: string) {
		super(`Show with id "${id}" not found in source`);
		this.name = 'ShowBlockNotFoundError';
	}
}

/**
 * Remove a show's text block from vcr-data.ts source.
 *
 * Show blocks are emitted with predictable indentation: `\t{` opens, `\t},` closes.
 * Episodes nest at `\t\t\t{` / `\t\t\t}` — different indent, so they don't confuse the scan.
 * This preserves comments, sentinel, and the rest of the file exactly.
 */
export function removeShowBlock(source: string, id: string): string {
	const lines = source.split('\n');
	const idLine = `\t\tid: '${id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`;
	const idIdx = lines.indexOf(idLine);
	if (idIdx === -1) throw new ShowBlockNotFoundError(id);

	let start = idIdx - 1;
	while (start >= 0 && lines[start] !== '\t{') start--;
	if (start < 0) throw new Error(`Malformed source: no opening "\\t{" before id line for "${id}"`);

	let end = idIdx + 1;
	while (end < lines.length && lines[end] !== '\t},') end++;
	if (end >= lines.length)
		throw new Error(`Malformed source: no closing "\\t}," after id line for "${id}"`);

	lines.splice(start, end - start + 1);
	return lines.join('\n');
}

/** Emit a single SHOWS array entry — matches the hand-written style in vcr-data.ts. */
export function buildShowBlock(show: ShowInput): string {
	const lines = [
		'\t{',
		`\t\tid: '${escapeSingleQuoted(show.id)}',`,
		`\t\tname: '${escapeSingleQuoted(show.name)}',`,
		`\t\tyears: '${escapeSingleQuoted(show.years)}',`,
		`\t\tdescription:`,
		`\t\t\t'${escapeSingleQuoted(show.description)}',`,
		`\t\tepisodes: [`
	];
	show.episodes.forEach((ep, i) => {
		lines.push(...emitEpisode(ep, i === show.episodes.length - 1));
	});
	lines.push('\t\t]');
	lines.push('\t},');
	return lines.join('\n');
}
