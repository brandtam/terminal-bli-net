import { describe, it, expect, vi, afterEach } from 'vitest';
import { moderateText } from './moderation';

function anthropicReply(text: string, status = 200): Response {
	return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('moderateText', () => {
	it('is unavailable without an API key — fail closed starts here', async () => {
		expect(await moderateText({}, 'BBS post', 'hello')).toBe('unavailable');
	});

	it('maps the verdict words', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('OK')));
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'fine')).toBe('ok');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply(' reject ')));
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'bad')).toBe('reject');
	});

	it('treats API errors, junk verdicts, and thrown fetches as unavailable', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('', 500)));
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'x')).toBe('unavailable');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicReply('MAYBE?')));
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'x')).toBe('unavailable');

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network says no')));
		expect(await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'x')).toBe('unavailable');
	});

	it('bounds the input it sends and never streams', async () => {
		const fetchMock = vi.fn().mockResolvedValue(anthropicReply('OK'));
		vi.stubGlobal('fetch', fetchMock);
		await moderateText({ ANTHROPIC_API_KEY: 'k' }, 'BBS post', 'y'.repeat(100_000));

		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		expect(body.messages[0].content.length).toBeLessThan(7_000);
		expect(body.max_tokens).toBeLessThanOrEqual(8);
		expect(body.stream).toBeUndefined();
	});
});
