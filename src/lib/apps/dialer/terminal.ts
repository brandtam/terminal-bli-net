/**
 * The Dialer's text pipeline: canon content is authored in a tiny color
 * markup ({Y}, {*W}, {/}) compiled to runs of styled text — no raw ANSI
 * escape parsing in v1 (see the PRD's terminal rendering spec). User-supplied
 * text never gets markup: it is escaped before it touches the compiler, so
 * only canon content can color itself.
 */

/** One run of same-colored text. `fg` is a palette code, null = phosphor. */
export type Run = { text: string; fg: string | null };

/**
 * The 16 CGA/ANSI colors as markup codes. Lowercase in the map below means
 * the code is written as-is ({R}); bright variants are {*R}. The actual hex
 * values live in the terminal's CSS — the compiler only deals in codes.
 */
const COLOR_CODES = new Set(['K', 'R', 'G', 'Y', 'B', 'M', 'C', 'W']);

/**
 * Compile markup source to runs. Grammar, all of it:
 *   {X}  — switch to color X (K R G Y B M C W)
 *   {*X} — switch to bright X
 *   {/}  — reset to the default phosphor
 *   {{   — literal '{'
 * Unknown sequences pass through as literal text (canon typos should be
 * visible, not invisible).
 */
export function compileMarkup(src: string): Run[] {
	const runs: Run[] = [];
	let fg: string | null = null;
	let text = '';

	const flush = () => {
		if (text) runs.push({ text, fg });
		text = '';
	};

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (ch !== '{') {
			text += ch;
			continue;
		}
		if (src[i + 1] === '{') {
			text += '{';
			i++;
			continue;
		}
		const close = src.indexOf('}', i);
		const code = close === -1 ? '' : src.slice(i + 1, close);
		if (code === '/') {
			flush();
			fg = null;
			i = close;
		} else if (COLOR_CODES.has(code)) {
			flush();
			fg = code;
			i = close;
		} else if (code.length === 2 && code[0] === '*' && COLOR_CODES.has(code[1])) {
			flush();
			fg = code;
			i = close;
		} else {
			text += ch; // not markup — literal brace
		}
	}
	flush();
	return runs;
}

/** Escape user text so it can never smuggle color codes into the compiler. */
export function escapeMarkup(s: string): string {
	return s.replaceAll('{', '{{');
}

/** Strip markup, leaving the plain text a screen would show. */
export function plainText(src: string): string {
	return compileMarkup(src)
		.map((r) => r.text)
		.join('');
}

/**
 * Hard-wrap plain text at `cols`, breaking on spaces where possible. Used for
 * user-authored bodies; canon content is authored pre-wrapped to 80 columns.
 */
export function wrapText(text: string, cols = 80): string[] {
	const out: string[] = [];
	for (const raw of text.split('\n')) {
		let line = raw;
		while (line.length > cols) {
			let cut = line.lastIndexOf(' ', cols);
			if (cut <= 0) cut = cols;
			out.push(line.slice(0, cut));
			line = line.slice(cut).trimStart();
		}
		out.push(line);
	}
	return out;
}

/** Chars per second at 8N1 framing: one char = 10 bits on the wire. */
export function charsPerSecond(baud: number): number {
	return baud / 10;
}

export const BAUD_RATES = [300, 2400, 9600] as const;
export type BaudRate = (typeof BAUD_RATES)[number];
