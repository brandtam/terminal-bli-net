import { describe, it, expect, vi, afterEach } from 'vitest';
import { moderateText, moderationMode } from './moderation';

function anthropicReply(text: string, status = 200): Response {
	return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status });
}

/** Just enough D1 for the daily-cap counter: one row, increment-and-return. */
function fakeCounterDb(startAt = 0) {
	let value = startAt;
	return {
		prepare: () => ({
			bind: () => ({
				first: async () => {
					value += 1;
					return { value };
				}
			})
		})
	} as unknown as D1Database;
}

const LIVE = { DIALER_MODERATION: 'live', ANTHROPIC_API_KEY: 'k' };

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('moderationMode', () => {
	it('defaults to open — no switch, no LLM calls', () => {
		expect(moderationMode({})).toBe('open');
		expect(moderationMode({ DIALER_MODERATION: 'nonsense' })).toBe('open');
	});

	it('recognises live and hold, forgiving case and whitespace', () => {
		expect(moderationMode({ DIALER_MODERATION: ' LIVE ' })).toBe('live');
		expect(moderationMode({ DIALER_MODERATION: 'hold' })).toBe('hold');
	});
});

describe('moderateText', () => {
	it('open mode (the default) publishes without calling the API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'hello')).toBe('ok');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('hold mode holds everything without calling the API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		expect(
			await moderateText({ DIALER_MODERATION: 'hold', ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'x')
		).toBe('unavailable');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('live mode without an API key is unavailable — fail closed starts here', async () => {
		expect(await moderateText({ DIALER_MODERATION: 'live' }, 'BBS post', 'hello')).toBe(
			'unavailable'
		);
	});

	it('maps the verdict words', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('OK')));
		expect(await moderateText(LIVE, 'BBS post', 'fine')).toBe('ok');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply(' reject ')));
		expect(await moderateText(LIVE, 'BBS post', 'bad')).toBe('reject');
	});

	it('treats API errors, junk verdicts, and thrown fetches as unavailable', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('', 500)));
		expect(await moderateText(LIVE, 'BBS post', 'x')).toBe('unavailable');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('MAYBE?')));
		expect(await moderateText(LIVE, 'BBS post', 'x')).toBe('unavailable');

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network says no')));
		expect(await moderateText(LIVE, 'BBS post', 'x')).toBe('unavailable');
	});

	it('meters live mode against the daily cap and refuses over it, no API call', async () => {
		const fetchMock = vi.fn().mockImplementation(async () => anthropicReply('OK'));
		vi.stubGlobal('fetch', fetchMock);
		const env = { ...LIVE, DIALER_MODERATION_DAILY_CAP: '2', DIALER_DB: fakeCounterDb() };

		expect(await moderateText(env, 'BBS post', 'a')).toBe('ok');
		expect(await moderateText(env, 'BBS post', 'b')).toBe('ok');
		expect(await moderateText(env, 'BBS post', 'c')).toBe('unavailable');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('a cap of 0 is a valid off switch; a junk cap falls back to the default', async () => {
		const fetchMock = vi.fn().mockResolvedValue(anthropicReply('OK'));
		vi.stubGlobal('fetch', fetchMock);

		const zero = { ...LIVE, DIALER_MODERATION_DAILY_CAP: '0', DIALER_DB: fakeCounterDb() };
		expect(await moderateText(zero, 'BBS post', 'x')).toBe('unavailable');
		expect(fetchMock).not.toHaveBeenCalled();

		const junk = { ...LIVE, DIALER_MODERATION_DAILY_CAP: 'lots', DIALER_DB: fakeCounterDb() };
		expect(await moderateText(junk, 'BBS post', 'x')).toBe('ok');
	});

	it('a broken counter fails closed, not open', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('OK')));
		const db = {
			prepare: () => {
				throw new Error('D1 says no');
			}
		} as unknown as D1Database;
		expect(await moderateText({ ...LIVE, DIALER_DB: db }, 'BBS post', 'x')).toBe('unavailable');
	});

	it('bounds the input it sends and never streams', async () => {
		const fetchMock = vi.fn().mockResolvedValue(anthropicReply('OK'));
		vi.stubGlobal('fetch', fetchMock);
		await moderateText(LIVE, 'BBS post', 'y'.repeat(100_000));

		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body.messages[0].content.length).toBeLessThan(7_000);
		expect(body.max_tokens).toBeLessThanOrEqual(8);
		expect(body.stream).toBeUndefined();
	});
});
