import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { streamCompletion } from '$lib/server/llm';
import { canRespond, recordMessage, recordTokens } from '$lib/server/spend';
import { getBotById, loadChannels, loadGroups } from '$lib/server/bots';
import type { Bot, Channel, Show, TextChunk } from '$lib/types';

vi.mock('$lib/server/llm', () => ({
	streamCompletion: vi.fn()
}));

vi.mock('$lib/server/spend', () => ({
	canRespond: vi.fn(),
	recordMessage: vi.fn(),
	recordTokens: vi.fn()
}));

vi.mock('$lib/server/bots', () => ({
	getBotById: vi.fn(),
	loadChannels: vi.fn(),
	loadGroups: vi.fn()
}));

const streamCompletionMock = vi.mocked(streamCompletion);
const canRespondMock = vi.mocked(canRespond);
const recordMessageMock = vi.mocked(recordMessage);
const recordTokensMock = vi.mocked(recordTokens);
const getBotByIdMock = vi.mocked(getBotById);
const loadChannelsMock = vi.mocked(loadChannels);
const loadGroupsMock = vi.mocked(loadGroups);

const sessionId = '00000000-0000-4000-8000-000000000000';

const bot: Bot = {
	id: 'george',
	group: 'seinfeld',
	name: 'George Costanza',
	occupation: 'Importer/exporter',
	image: '/bots/seinfeld/george.jpg',
	greeting: 'Yeah?',
	bio: 'Neurotic New Yorker.',
	prompt: 'You are George Costanza. Be neurotic.'
};

const show: Show = {
	slug: 'seinfeld',
	name: 'Seinfeld',
	description: '',
	setting: '',
	era: '',
	image: '',
	active: true,
	episodes: [
		{
			season: 3,
			episode: 7,
			title: 'The Cafe',
			year: '1991',
			premise: 'George worries about taking an IQ test.'
		},
		{
			season: 5,
			episode: 14,
			title: 'The Marine Biologist',
			year: '1994',
			premise: 'George claims to be a marine biologist.'
		}
	]
};

function makeChannel(slots: Record<number, NonNullable<Channel['schedule'][number]>>): Channel {
	const schedule: Channel['schedule'] = Array(48).fill(null);
	for (const [slotIndex, slot] of Object.entries(slots)) {
		schedule[Number(slotIndex)] = slot;
	}

	return {
		slug: 'ch-comedy',
		name: 'Comedy',
		number: 6,
		network: 'CHATR',
		schedule
	};
}

function makeTokenStream(chunks: TextChunk[]): ReadableStream<TextChunk> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(chunk);
			}
			controller.close();
		}
	});
}

function makeEvent(body: Record<string, unknown>) {
	return {
		request: new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: {
			env: {
				KV: {},
				LLM_PROVIDER_ORDER: 'openai',
				OPENAI_API_KEY: 'test-openai-key',
				OPENAI_MODEL: 'gpt-4o-mini',
				OPENAI_MONTHLY_SPEND_CAP: '25'
			}
		},
		getClientAddress: () => '127.0.0.1'
	} as Parameters<typeof POST>[0];
}

function makeBody(timezone: string) {
	return {
		botId: 'george',
		sessionId,
		timezone,
		messages: [{ role: 'user', content: 'What is going on?' }]
	};
}

describe('POST /api/chat', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-04T10:00:00Z'));

		getBotByIdMock.mockReturnValue(bot);
		loadGroupsMock.mockReturnValue([show]);
		loadChannelsMock.mockReturnValue([
			makeChannel({
				20: { showSlug: 'seinfeld', season: 3, episode: 7 },
				31: { showSlug: 'seinfeld', season: 5, episode: 14 }
			})
		]);
		canRespondMock.mockResolvedValue({ allowed: true });
		recordMessageMock.mockResolvedValue();
		recordTokensMock.mockResolvedValue(0);
		streamCompletionMock.mockResolvedValue(
			makeTokenStream([
				{ type: 'text', text: 'Well, ' },
				{ type: 'text', text: 'we are living in a society.' },
				{
					type: 'done',
					tokenCount: 7,
					usage: {
						provider: 'openai',
						model: 'gpt-4o-mini',
						inputTokens: 5,
						outputTokens: 2
					}
				}
			])
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it('rejects a valid bot when its show is off air in the requested timezone before spend or LLM calls', async () => {
		await expect(POST(makeEvent(makeBody('America/New_York')))).rejects.toMatchObject({
			status: 403
		});

		expect(canRespondMock).not.toHaveBeenCalled();
		expect(streamCompletionMock).not.toHaveBeenCalled();
		expect(recordMessageMock).not.toHaveBeenCalled();
		expect(recordTokensMock).not.toHaveBeenCalled();
	});

	it('accepts the same bot when its show is airing and sends requested-timezone episode context to the LLM', async () => {
		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		await response.text();

		expect(response.status).toBe(200);
		expect(streamCompletionMock).toHaveBeenCalledTimes(1);
		expect(streamCompletionMock.mock.calls[0][0].systemPrompt).toContain(
			'[SCENE CONTEXT: Currently airing S5E14 "The Marine Biologist"'
		);
		expect(streamCompletionMock.mock.calls[0][0].systemPrompt).toContain(
			'George claims to be a marine biologist.'
		);
		expect(streamCompletionMock.mock.calls[0][0].providers).toEqual([
			{
				provider: 'openai',
				apiKey: 'test-openai-key',
				model: 'gpt-4o-mini',
				monthlyBudget: 25
			}
		]);
		expect(recordMessageMock).toHaveBeenCalledTimes(1);
		expect(recordMessageMock).toHaveBeenCalledWith({}, '127.0.0.1');
		expect(recordTokensMock).toHaveBeenCalledWith(
			{},
			{
				provider: 'openai',
				model: 'gpt-4o-mini',
				inputTokens: 5,
				outputTokens: 2
			}
		);
	});

	it('records provider usage chunks without forwarding them to the browser stream', async () => {
		streamCompletionMock.mockResolvedValueOnce(
			makeTokenStream([
				{ type: 'text', text: 'Partial answer.' },
				{
					type: 'usage',
					tokenCount: 9,
					usage: {
						provider: 'openai',
						model: 'gpt-4o-mini',
						inputTokens: 5,
						outputTokens: 4,
						estimated: true
					}
				},
				{ type: 'text', text: ' Fresh answer.' },
				{
					type: 'done',
					tokenCount: 7,
					usage: {
						provider: 'openai',
						model: 'gpt-4o-mini',
						inputTokens: 5,
						outputTokens: 2
					}
				}
			])
		);

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		const text = await response.text();

		expect(text).toContain('Partial answer.');
		expect(text).toContain('Fresh answer.');
		expect(text).not.toContain('"type":"usage"');
		expect(recordTokensMock).toHaveBeenCalledTimes(2);
		expect(recordTokensMock.mock.calls[0][1]).toMatchObject({
			provider: 'openai',
			model: 'gpt-4o-mini',
			estimated: true
		});
		expect(recordTokensMock.mock.calls[1][1]).toMatchObject({
			provider: 'openai',
			model: 'gpt-4o-mini'
		});
		expect(recordTokensMock.mock.calls[1][1].estimated).toBeUndefined();
	});

	it('still forwards done chunks when token accounting fails', async () => {
		recordTokensMock.mockRejectedValueOnce(new Error('KV write failed'));

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		const text = await response.text();

		expect(text).toContain('"type":"done"');
		expect(text).not.toContain('"type":"error"');
	});

	it('rejects an invalid timezone before spend or LLM calls', async () => {
		await expect(POST(makeEvent(makeBody('Not/A_Zone')))).rejects.toMatchObject({
			status: 400
		});

		expect(canRespondMock).not.toHaveBeenCalled();
		expect(streamCompletionMock).not.toHaveBeenCalled();
	});
});
