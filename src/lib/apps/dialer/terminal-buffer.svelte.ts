import { compileMarkup, type Run } from './terminal';

/**
 * The reactive display buffer behind the terminal: an append-only scroll of
 * colored runs, fed through a queue so text arrives at baud speed instead of
 * all at once. The component owns the clock (it calls `tick` from a rAF
 * loop); the buffer just moves characters from queue to screen, which keeps
 * it fully testable without timers.
 */
export class TerminalBuffer {
	static readonly COLS = 80;
	static readonly MAX_LINES = 600;

	lines = $state<Run[][]>([[]]);
	typing = $state(false);

	private queue: { ch: string; fg: string | null }[] = [];
	private col = 0;

	/** Queue markup text for baud-speed output. A newline is appended. */
	print(markup: string): void {
		for (const run of compileMarkup(markup)) {
			for (const ch of run.text) this.queue.push({ ch, fg: run.fg });
		}
		this.queue.push({ ch: '\n', fg: null });
		this.typing = true;
	}

	printLines(lines: string[]): void {
		for (const line of lines) this.print(line);
	}

	/** Emit up to `count` queued characters. The rAF loop calls this. */
	tick(count: number): void {
		for (let i = 0; i < count && this.queue.length > 0; i++) this.emit(this.queue.shift()!);
		if (this.queue.length === 0) this.typing = false;
	}

	/**
	 * Complete everything queued instantly. The component calls this on any
	 * keypress mid-type (the PRD's merciful skip) and then still routes the
	 * key — type-ahead, not consumption.
	 */
	skip(): void {
		while (this.queue.length > 0) this.emit(this.queue.shift()!);
		this.typing = false;
	}

	clear(): void {
		this.lines = [[]];
		this.queue = [];
		this.col = 0;
		this.typing = false;
	}

	/** The whole visible screen as plain text (for tests and copy/paste). */
	toText(): string {
		return this.lines.map((line) => line.map((r) => r.text).join('')).join('\n');
	}

	private emit(token: { ch: string; fg: string | null }): void {
		if (token.ch === '\n' || this.col >= TerminalBuffer.COLS) {
			this.lines.push([]);
			this.col = 0;
			if (this.lines.length > TerminalBuffer.MAX_LINES)
				this.lines.splice(0, this.lines.length - TerminalBuffer.MAX_LINES);
			if (token.ch === '\n') return;
		}
		const line = this.lines[this.lines.length - 1];
		const last = line[line.length - 1];
		if (last && last.fg === token.fg) {
			// Mutating the run in place keeps runs coalesced; reassigning the
			// array element (not just the string) keeps $state reactivity honest.
			line[line.length - 1] = { text: last.text + token.ch, fg: last.fg };
		} else {
			line.push({ text: token.ch, fg: token.fg });
		}
		this.col++;
	}
}
