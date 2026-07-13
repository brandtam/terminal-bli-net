import { describe, it, expect } from 'vitest';
import { compileMarkup, escapeMarkup, plainText, wrapText, charsPerSecond } from './terminal';
import { TerminalBuffer } from './terminal-buffer.svelte';

describe('compileMarkup', () => {
	it('splits colored runs and resets to phosphor', () => {
		expect(compileMarkup('plain {Y}gold{/} plain')).toEqual([
			{ text: 'plain ', fg: null },
			{ text: 'gold', fg: 'Y' },
			{ text: ' plain', fg: null }
		]);
	});

	it('handles bright variants', () => {
		expect(compileMarkup('{*W}bright{/}')).toEqual([{ text: 'bright', fg: '*W' }]);
	});

	it('passes unknown sequences through as literal text', () => {
		expect(plainText('{Z}nope{}')).toBe('{Z}nope{}');
	});

	it('unescapes doubled braces to a literal brace', () => {
		expect(plainText('a {{Y} b')).toBe('a {Y} b');
	});

	it('never lets escaped user text color itself', () => {
		const hostile = 'look {*R}RED{/} text';
		const runs = compileMarkup(escapeMarkup(hostile));
		expect(runs.every((r) => r.fg === null)).toBe(true);
		expect(runs.map((r) => r.text).join('')).toBe(hostile);
	});
});

describe('wrapText', () => {
	it('breaks on spaces at the column limit', () => {
		expect(wrapText('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc']);
	});

	it('hard-breaks unbroken runs longer than the limit', () => {
		expect(wrapText('abcdefgh', 4)).toEqual(['abcd', 'efgh']);
	});

	it('preserves existing newlines', () => {
		expect(wrapText('a\nb', 80)).toEqual(['a', 'b']);
	});
});

describe('charsPerSecond', () => {
	it('is baud over ten (8N1: start bit + 8 data + stop bit)', () => {
		expect(charsPerSecond(300)).toBe(30);
		expect(charsPerSecond(2400)).toBe(240);
		expect(charsPerSecond(9600)).toBe(960);
	});
});

describe('TerminalBuffer', () => {
	it('queues printed text and emits it on tick', () => {
		const term = new TerminalBuffer();
		term.print('HELLO');
		expect(term.typing).toBe(true);
		expect(term.toText()).toBe('');
		term.tick(3);
		expect(term.toText()).toBe('HEL');
		term.tick(100);
		expect(term.typing).toBe(false);
		expect(term.toText()).toBe('HELLO\n');
	});

	it('skip() completes the whole queue instantly', () => {
		const term = new TerminalBuffer();
		term.printLines(['ONE', 'TWO']);
		term.skip();
		expect(term.typing).toBe(false);
		expect(term.toText()).toBe('ONE\nTWO\n');
	});

	it('keeps color runs coalesced per line', () => {
		const term = new TerminalBuffer();
		term.print('{Y}ab{/}cd');
		term.skip();
		expect(term.lines[0]).toEqual([
			{ text: 'ab', fg: 'Y' },
			{ text: 'cd', fg: null }
		]);
	});

	it('auto-wraps at 80 columns', () => {
		const term = new TerminalBuffer();
		term.print('x'.repeat(85));
		term.skip();
		expect(term.lines[0].map((r) => r.text).join('')).toHaveLength(80);
		expect(term.lines[1].map((r) => r.text).join('')).toHaveLength(5);
	});

	it('caps scrollback at MAX_LINES', () => {
		const term = new TerminalBuffer();
		for (let i = 0; i < TerminalBuffer.MAX_LINES + 50; i++) term.print(`line ${i}`);
		term.skip();
		expect(term.lines.length).toBeLessThanOrEqual(TerminalBuffer.MAX_LINES);
	});

	it('clear() empties screen and queue', () => {
		const term = new TerminalBuffer();
		term.print('pending');
		term.clear();
		term.tick(100);
		expect(term.toText()).toBe('');
		expect(term.typing).toBe(false);
	});
});
