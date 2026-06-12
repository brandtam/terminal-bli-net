import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamCompletion, defaultModelFor, isLlmProvider } from '$lib/server/llm';
import { canRespond, recordMessage } from '$lib/server/spend';
import { getSpendLedger, actualCostUsd } from '$lib/server/spend-ledger';
import type {
	CandidateProvider,
	DenialReason,
	ProviderReservation,
	SpendLedgerEnv
} from '$lib/server/spend-ledger';
import { evaluateChatGate } from '$lib/server/turnstile';
import { loadContentCatalog } from '$lib/server/content-catalog';
import { createChatSession, validateChatTimezone } from '$lib/server/chat-session';
import type { ChatMessage, LlmProvider, LlmTokenUsage, TextChunk } from '$lib/types';
import type { LlmProviderConfig } from '$lib/server/llm';

const VALID_ROLES = new Set(['user', 'assistant']);
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;
/** Hard per-request output cap; also the worst-case output hold for a Reservation. */
const MAX_OUTPUT_TOKENS = 300;
const TOKEN_OVERHEAD_FOR_SYSTEM = 64;
const TOKEN_OVERHEAD_PER_MESSAGE = 64;
const textEncoder = new TextEncoder();

// Monthly spend caps come in via SpendLedgerEnv (the ledger reads them); this
// interface adds the route's own provider/model + KV throttle vars.
interface ChatEnv extends SpendLedgerEnv {
	KV: KVNamespace;
	ANTHROPIC_API_KEY?: string;
	OPENAI_API_KEY?: string;
	LLM_PROVIDER_ORDER?: string;
	ANTHROPIC_MODEL?: string;
	OPENAI_MODEL?: string;
	RATE_LIMIT_PER_HOUR?: string;
	PROVIDER?: string;
	MODEL?: string;
	/** Turnstile secret (a deploy secret). Unset in dev → the gate fails open. */
	TURNSTILE_SECRET?: string;
}

const PROVIDER_API_KEY_ENV = {
	claude: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY'
} satisfies Record<LlmProvider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'>;

const PROVIDER_MODEL_ENV = {
	claude: 'ANTHROPIC_MODEL',
	openai: 'OPENAI_MODEL'
} satisfies Record<LlmProvider, 'ANTHROPIC_MODEL' | 'OPENAI_MODEL'>;

function parseProviderOrder(raw: string | undefined): LlmProvider[] {
	const providerOrder = (raw ?? 'claude')
		.split(',')
		.map((provider) => provider.trim())
		.filter(Boolean);

	if (providerOrder.length === 0) {
		throw error(500, 'LLM provider order is empty');
	}

	const providers: LlmProvider[] = [];
	for (const provider of providerOrder) {
		if (!isLlmProvider(provider)) {
			throw error(500, `Unsupported LLM provider "${provider}"`);
		}
		if (!providers.includes(provider)) {
			providers.push(provider);
		}
	}

	return providers;
}

function resolveLlmProviders(env: ChatEnv): LlmProviderConfig[] {
	const legacyProvider =
		env.PROVIDER === 'claude' || env.PROVIDER === 'openai' ? env.PROVIDER : undefined;
	const providerOrder = parseProviderOrder(env.LLM_PROVIDER_ORDER ?? legacyProvider);

	// Monthly dollar caps are no longer carried per provider — the Spend Ledger
	// owns them (resolveCeilings reads ANTHROPIC/OPENAI_MONTHLY_SPEND_CAP). Here we
	// only resolve which providers are configured and which model each uses.
	return providerOrder.flatMap((provider) => {
		const apiKey = env[PROVIDER_API_KEY_ENV[provider]];
		if (!apiKey) return [];

		const model =
			env[PROVIDER_MODEL_ENV[provider]] ?? (legacyProvider === provider ? env.MODEL : undefined);

		return [{ provider, apiKey, model }];
	});
}

function validateMessages(raw: unknown): ChatMessage[] {
	if (!Array.isArray(raw)) throw error(400, 'messages must be an array');
	if (raw.length === 0) throw error(400, 'messages must not be empty');
	if (raw.length > MAX_MESSAGES) throw error(400, `messages exceeds max of ${MAX_MESSAGES}`);

	return raw.map((m, i) => {
		if (typeof m !== 'object' || m === null) throw error(400, `messages[${i}] is invalid`);
		const { role, content } = m as Record<string, unknown>;
		if (typeof role !== 'string' || !VALID_ROLES.has(role)) {
			throw error(400, `messages[${i}].role must be "user" or "assistant"`);
		}
		if (typeof content !== 'string' || content.length === 0) {
			throw error(400, `messages[${i}].content must be a non-empty string`);
		}
		if (content.length > MAX_CONTENT_LENGTH) {
			throw error(400, `messages[${i}].content exceeds max length`);
		}
		return { role: role as 'user' | 'assistant', content };
	});
}

function parseRateLimitPerHour(raw: string | undefined): number {
	if (raw === undefined || raw.trim() === '') return 30;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : 30;
}

/** Worst-case input tokens for the Reservation — a true upper bound, not a guess. */
function worstCaseInputTokens(systemPrompt: string, messages: ChatMessage[]): number {
	let tokens = textEncoder.encode(systemPrompt).length + TOKEN_OVERHEAD_FOR_SYSTEM;
	for (const message of messages) {
		tokens +=
			textEncoder.encode(message.role).length +
			textEncoder.encode(message.content).length +
			TOKEN_OVERHEAD_PER_MESSAGE;
	}
	return tokens;
}

function resolvedModel(config: LlmProviderConfig): string {
	return config.model ?? defaultModelFor(config.provider);
}

/** Map the ledger's provider preference order onto concrete candidate models. */
function toCandidates(providers: LlmProviderConfig[]): CandidateProvider[] {
	return providers.map((config) => ({
		provider: config.provider,
		model: resolvedModel(config)
	}));
}

function toReservedProviders(
	providers: LlmProviderConfig[],
	reservations: ProviderReservation[]
): LlmProviderConfig[] {
	return reservations.flatMap((reservation) => {
		const config = providers.find(
			(provider) =>
				provider.provider === reservation.provider && resolvedModel(provider) === reservation.model
		);
		return config ? [{ ...config, model: reservation.model }] : [];
	});
}

function reservationForUsage(
	reservations: ProviderReservation[],
	usage: LlmTokenUsage
): ProviderReservation | undefined {
	const exact = reservations.find(
		(reservation) => reservation.provider === usage.provider && reservation.model === usage.model
	);
	if (exact) return exact;

	const providerMatches = reservations.filter(
		(reservation) => reservation.provider === usage.provider
	);
	return providerMatches.length === 1 ? providerMatches[0] : undefined;
}

/**
 * In-voice "off the air" copy for a refused request. The chat window renders it
 * as a normal assistant turn so the retro-OS fiction stays intact — never a raw
 * HTTP error (see PRD decision 11).
 */
function overBudgetMessage(reason: DenialReason): string {
	if (reason === 'ledger-unavailable') {
		return '[ STATIC ] ...technical difficulties — the transmitter dropped out for a sec. Give it a moment and try again.';
	}
	if (reason === 'monthly-provider') {
		return "[ STATIC ] ...this channel's gone dark for the month — the dial's tapped out. Try another network, or check back when the new month rolls around.";
	}
	return "[ STATIC ] ...that's all she wrote for today — we're off the air until the tower fires back up tomorrow. Same station, same dial.";
}

/** Build an SSE Response from a TextChunk source, hiding internal `usage` chunks. */
function sseResponse(
	source: ReadableStream<TextChunk>,
	hooks?: {
		onUsage?: (chunk: TextChunk) => void;
		onClose?: () => void | Promise<void>;
	},
	extraHeaders?: Record<string, string>
): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const reader = source.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					if (value.type !== 'usage') {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
					}
					if (value.usage) hooks?.onUsage?.(value);
				}
			} catch (e) {
				console.error('[chat SSE] stream error:', e);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'internal error' })}\n\n`)
				);
			} finally {
				try {
					await hooks?.onClose?.();
				} catch (e) {
					console.error('[chat SSE] close hook failed:', e);
				}
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			...extraHeaders
		}
	});
}

/** A one-shot SSE stream of a single in-voice assistant message (the deny path). */
function messageStream(text: string): ReadableStream<TextChunk> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue({ type: 'text', text });
			controller.enqueue({ type: 'done', tokenCount: 0 });
			controller.close();
		}
	});
}

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	if (!platform?.env) {
		throw error(500, 'Platform bindings not available');
	}

	const env = platform.env as ChatEnv;
	const ip = getClientAddress();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (typeof body !== 'object' || body === null) {
		throw error(400, 'Request body must be a JSON object');
	}

	const {
		botId,
		messages: rawMessages,
		timezone: rawTimezone,
		turnstileToken: rawTurnstileToken,
		sessionToken: rawSessionToken
	} = body as Record<string, unknown>;

	if (typeof botId !== 'string' || !botId) {
		throw error(400, 'botId is required');
	}

	const turnstileToken = typeof rawTurnstileToken === 'string' ? rawTurnstileToken : undefined;
	const sessionToken = typeof rawSessionToken === 'string' ? rawSessionToken : undefined;

	const messages = validateMessages(rawMessages);
	let timezone: string;
	try {
		timezone = validateChatTimezone(rawTimezone);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'timezone is invalid');
	}

	const catalog = loadContentCatalog();
	const bot = catalog.botsById.get(botId);
	if (!bot) {
		throw error(404, `Bot "${botId}" not found`);
	}

	const chatSession = createChatSession({
		bot,
		channels: catalog.channels,
		shows: catalog.shows,
		now: new Date(),
		timezone
	});

	if (!chatSession.allowed || !chatSession.systemPrompt) {
		throw error(chatSession.status, chatSession.reason ?? 'Chat is not available');
	}

	// Per-IP fairness throttle (approximate, KV) — unchanged.
	const gate = await canRespond(
		{ kv: env.KV, rateLimitPerHour: parseRateLimitPerHour(env.RATE_LIMIT_PER_HOUR) },
		ip
	);
	if (!gate.allowed) {
		throw error(429, gate.reason || 'Rate limited');
	}

	// Turnstile Gate — proof-of-human before any spend path (PRD decision 10).
	// A valid session token skips the challenge; a fresh Turnstile token mints one.
	const humanGate = await evaluateChatGate(
		env.TURNSTILE_SECRET,
		{ turnstileToken, sessionToken, remoteIp: ip },
		new Date()
	);
	if (!humanGate.ok) {
		// Not verified (or session expired) — the client runs the challenge and
		// retries. A 401 stays invisible to the user, keeping the fiction intact.
		throw error(401, 'Human verification required');
	}
	const sessionHeaders = humanGate.issuedSessionToken
		? { 'X-Chat-Session': humanGate.issuedSessionToken }
		: undefined;

	const providers = resolveLlmProviders(env);
	if (providers.length === 0) {
		throw error(503, 'No LLM providers are configured');
	}

	// The Spend Ledger owns every dollar ceiling: reserve worst-case cost for each
	// fallback candidate that fits before any provider can spend.
	await recordMessage(env.KV, ip);

	const ledger = getSpendLedger(env);
	const reservation = await ledger.reserve(
		{
			candidates: toCandidates(providers),
			maxInputTokens: worstCaseInputTokens(chatSession.systemPrompt, messages),
			maxOutputTokens: MAX_OUTPUT_TOKENS
		},
		new Date()
	);

	if (!reservation.ok) {
		// Ceiling hit — render a graceful in-voice "off the air" turn, not an error.
		// Still return any freshly minted session token so a retry isn't re-challenged.
		return sseResponse(
			messageStream(overBudgetMessage(reservation.reason)),
			undefined,
			sessionHeaders
		);
	}

	const reservations = reservation.reservations;
	const admittedProviders = toReservedProviders(providers, reservations);
	if (admittedProviders.length === 0) {
		await Promise.all(reservations.map((hold) => ledger.release(hold.reservationId, new Date())));
		throw error(500, 'Admitted provider is not configured');
	}

	const stream = await streamCompletion({
		systemPrompt: chatSession.systemPrompt,
		messages,
		providers: admittedProviders,
		options: { maxTokens: MAX_OUTPUT_TOKENS, temperature: 0.8 }
	});

	// Settle each provider Reservation to actual cost once the stream ends; release
	// unused fallback holds. Runs in the SSE close hook so it fires even when the
	// client disconnects mid-stream.
	const actualByReservation = new Map<string, { provider: LlmProvider; usd: number }>();
	function settleLedger(): Promise<void> {
		const now = new Date();
		return Promise.all(
			reservations.map((hold) => {
				const actual = actualByReservation.get(hold.reservationId);
				if (actual) {
					return ledger.reconcile(hold.reservationId, actual, now);
				}
				return ledger.release(hold.reservationId, now);
			})
		).then(() => undefined);
	}

	return sseResponse(
		stream,
		{
			onUsage: (chunk) => {
				if (!chunk.usage) return;
				try {
					const hold = reservationForUsage(reservations, chunk.usage);
					if (!hold) {
						console.error('[chat SSE] usage reported for an unreserved provider:', chunk.usage);
						return;
					}
					const previous = actualByReservation.get(hold.reservationId);
					actualByReservation.set(hold.reservationId, {
						provider: chunk.usage.provider,
						usd: (previous?.usd ?? 0) + actualCostUsd(chunk.usage)
					});
				} catch (e) {
					console.error('[chat SSE] cost calculation failed:', e);
				}
			},
			onClose: () => {
				const settlement = settleLedger().catch((e) => {
					console.error('[chat SSE] ledger settlement failed:', e);
				});
				if (platform.context?.waitUntil) {
					platform.context.waitUntil(settlement);
					return;
				}
				return settlement;
			}
		},
		sessionHeaders
	);
};
