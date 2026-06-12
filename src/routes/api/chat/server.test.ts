import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { streamCompletion } from '$lib/server/llm';
import { canRespond, recordMessage } from '$lib/server/spend';
import { getSpendLedger, actualCostUsd } from '$lib/server/spend-ledger';
import { loadContentCatalog } from '$lib/server/content-catalog';
import type { Bot, Channel, Show, TextChunk } from '$lib/types';
import type { ContentCatalog } from '$lib/server/content-catalog';
import type { SpendLedger } from '$lib/server/spend-ledger';

vi.mock('$lib/server/llm', () => ({
	streamCompletion: vi.fn(),
	defaultModelFor: (provider: 'claude' | 'openai') =>
		provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001'
}));

vi.mock('$lib/server/spend', () => ({
	canRespond: vi.fn(),
	recordMessage: vi.fn()
}));

vi.mock('$lib/server/spend-ledger', () => ({
	getSpendLedger: vi.fn(),
	actualCostUsd: vi.fn()
}));

vi.mock('$lib/server/content-catalog', () => ({
	loadContentCatalog: vi.fn()
}));

const streamCompletionMock = vi.mocked(streamCompletion);
const canRespondMock = vi.mocked(canRespond);
const recordMessageMock = vi.mocked(recordMessage);
const getSpendLedgerMock = vi.mocked(getSpendLedger);
const actualCostUsdMock = vi.mocked(actualCostUsd);
const loadContentCatalogMock = vi.mocked(loadContentCatalog);

const reserveMock = vi.fn<SpendLedger['reserve']>();
const reconcileMock = vi.fn<SpendLedger['reconcile']>();
const releaseMock = vi.fn<SpendLedger['release']>();
const statusMock = vi.fn<SpendLedger['status']>();
const ledger: SpendLedger = {
	reserve: reserveMock,
	reconcile: reconcileMock,
	release: releaseMock,
	status: statusMock
};

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

function makeCatalog(channels: Channel[]): ContentCatalog {
	return {
		bots: [bot],
		groups: [show],
		shows: [show],
		channels,
		botsById: new Map([[bot.id, bot]]),
		botsByGroup: new Map([[bot.group, [bot]]]),
		groupsBySlug: new Map([[show.slug, show]]),
		showsBySlug: new Map([[show.slug, show]]),
		channelsBySlug: new Map(channels.map((channel) => [channel.slug, channel]))
	};
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

		loadContentCatalogMock.mockReturnValue(
			makeCatalog([
				makeChannel({
					20: { showSlug: 'seinfeld', season: 3, episode: 7 },
					31: { showSlug: 'seinfeld', season: 5, episode: 14 }
				})
			])
		);
		canRespondMock.mockResolvedValue({ allowed: true });
		recordMessageMock.mockResolvedValue();
		getSpendLedgerMock.mockReturnValue(ledger);
		reserveMock.mockResolvedValue({
			ok: true,
			reservationId: 'res-1',
			provider: 'openai',
			model: 'gpt-4o-mini',
			reservedUsd: 0.05,
			expiresAt: Date.now() + 60_000
		});
		reconcileMock.mockResolvedValue();
		releaseMock.mockResolvedValue();
		actualCostUsdMock.mockReturnValue(0.01);
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
		expect(reserveMock).not.toHaveBeenCalled();
		expect(streamCompletionMock).not.toHaveBeenCalled();
		expect(recordMessageMock).not.toHaveBeenCalled();
	});

	it('reserves against the ledger, streams the admitted provider, and reconciles actual cost', async () => {
		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		await response.text();

		expect(response.status).toBe(200);

		// Ledger admits the provider by budget before any spend.
		expect(reserveMock).toHaveBeenCalledTimes(1);
		expect(reserveMock.mock.calls[0][0]).toMatchObject({
			candidates: [{ provider: 'openai', model: 'gpt-4o-mini' }],
			maxOutputTokens: 300
		});
		expect(reserveMock.mock.calls[0][0].maxInputTokens).toBeGreaterThan(0);

		// The route streams from the single admitted provider/model.
		expect(streamCompletionMock).toHaveBeenCalledTimes(1);
		expect(streamCompletionMock.mock.calls[0][0].systemPrompt).toContain(
			'[SCENE CONTEXT: Currently airing S5E14 "The Marine Biologist"'
		);
		expect(streamCompletionMock.mock.calls[0][0].providers).toEqual([
			{
				provider: 'openai',
				apiKey: 'test-openai-key',
				model: 'gpt-4o-mini',
				monthlyBudget: 25
			}
		]);

		expect(recordMessageMock).toHaveBeenCalledWith({}, '127.0.0.1');

		// Reservation settles once to the summed actual cost; never released.
		expect(reconcileMock).toHaveBeenCalledTimes(1);
		expect(reconcileMock.mock.calls[0][0]).toBe('res-1');
		expect(reconcileMock.mock.calls[0][1]).toEqual({ provider: 'openai', usd: 0.01 });
		expect(releaseMock).not.toHaveBeenCalled();
	});

	it('sums actual cost across usage chunks and reconciles once, hiding usage chunks from the browser', async () => {
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
		actualCostUsdMock.mockReturnValueOnce(0.02).mockReturnValueOnce(0.03);

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		const text = await response.text();

		expect(text).toContain('Partial answer.');
		expect(text).toContain('Fresh answer.');
		expect(text).not.toContain('"type":"usage"');

		expect(actualCostUsdMock).toHaveBeenCalledTimes(2);
		expect(reconcileMock).toHaveBeenCalledTimes(1);
		expect(reconcileMock.mock.calls[0][1]).toEqual({ provider: 'openai', usd: 0.05 });
	});

	it('releases the reservation when the stream produces no billable usage', async () => {
		streamCompletionMock.mockResolvedValueOnce(
			makeTokenStream([{ type: 'text', text: 'silence' }])
		);

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		await response.text();

		expect(reconcileMock).not.toHaveBeenCalled();
		expect(releaseMock).toHaveBeenCalledWith('res-1', expect.any(Date));
	});

	it('still forwards done chunks when reconciliation fails', async () => {
		reconcileMock.mockRejectedValueOnce(new Error('ledger write failed'));

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		const text = await response.text();

		expect(text).toContain('"type":"done"');
		expect(text).not.toContain('"type":"error"');
	});

	it('returns a graceful in-voice message and spends nothing when a ceiling is hit', async () => {
		reserveMock.mockResolvedValueOnce({
			ok: false,
			ceiling: 'daily-spend',
			reason: 'Daily spend cap reached ($3/day).'
		});

		const response = await POST(makeEvent(makeBody('Asia/Kathmandu')));
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(text).toContain('off the air');
		expect(text).not.toContain('"type":"error"');

		expect(streamCompletionMock).not.toHaveBeenCalled();
		expect(recordMessageMock).not.toHaveBeenCalled();
		expect(reconcileMock).not.toHaveBeenCalled();
		expect(releaseMock).not.toHaveBeenCalled();
	});

	it('rejects an invalid timezone before spend or LLM calls', async () => {
		await expect(POST(makeEvent(makeBody('Not/A_Zone')))).rejects.toMatchObject({
			status: 400
		});

		expect(canRespondMock).not.toHaveBeenCalled();
		expect(reserveMock).not.toHaveBeenCalled();
		expect(streamCompletionMock).not.toHaveBeenCalled();
	});
});
