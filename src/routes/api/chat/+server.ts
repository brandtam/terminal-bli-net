import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamCompletion } from '$lib/server/llm';
import { canRespond, recordTokens, recordMessage } from '$lib/server/spend';
import { getBotById, loadChannels, loadGroups } from '$lib/server/bots';
import { createChatSession, validateChatTimezone } from '$lib/server/chat-session';
import type { ChatMessage, LlmProvider } from '$lib/types';
import type { LlmProviderConfig } from '$lib/server/llm';

const VALID_ROLES = new Set(['user', 'assistant']);
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

interface ChatEnv {
	KV: KVNamespace;
	ANTHROPIC_API_KEY?: string;
	OPENAI_API_KEY?: string;
	LLM_PROVIDER_ORDER?: string;
	ANTHROPIC_MODEL?: string;
	OPENAI_MODEL?: string;
	ANTHROPIC_MONTHLY_SPEND_CAP?: string;
	OPENAI_MONTHLY_SPEND_CAP?: string;
	RATE_LIMIT_PER_HOUR?: string;
	PROVIDER?: string;
	MONTHLY_SPEND_CAP?: string;
	MODEL?: string;
}

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
		if (provider !== 'claude' && provider !== 'openai') {
			throw error(500, `Unsupported LLM provider "${provider}"`);
		}
		if (!providers.includes(provider)) {
			providers.push(provider);
		}
	}

	return providers;
}

function parseBudget(raw: string | undefined): number | undefined {
	if (raw === undefined || raw.trim() === '') return undefined;
	const budget = Number(raw);
	if (!Number.isFinite(budget) || budget < 0) {
		throw error(500, `Invalid LLM monthly spend cap "${raw}"`);
	}
	return budget;
}

function resolveLlmProviders(env: ChatEnv): LlmProviderConfig[] {
	const legacyProvider =
		env.PROVIDER === 'claude' || env.PROVIDER === 'openai' ? env.PROVIDER : undefined;
	const providerOrder = parseProviderOrder(env.LLM_PROVIDER_ORDER ?? legacyProvider);

	return providerOrder.flatMap((provider) => {
		const apiKey = provider === 'claude' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
		if (!apiKey) return [];

		const model =
			provider === 'claude'
				? (env.ANTHROPIC_MODEL ?? (legacyProvider === 'claude' ? env.MODEL : undefined))
				: (env.OPENAI_MODEL ?? (legacyProvider === 'openai' ? env.MODEL : undefined));
		const monthlyBudget =
			provider === 'claude'
				? parseBudget(env.ANTHROPIC_MONTHLY_SPEND_CAP ?? env.MONTHLY_SPEND_CAP)
				: parseBudget(env.OPENAI_MONTHLY_SPEND_CAP ?? env.MONTHLY_SPEND_CAP);

		return [{ provider, apiKey, model, monthlyBudget }];
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

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	if (!platform?.env) {
		throw error(500, 'Platform bindings not available');
	}

	const env = platform.env;
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

	const { botId, messages: rawMessages, timezone: rawTimezone } = body as Record<string, unknown>;

	if (typeof botId !== 'string' || !botId) {
		throw error(400, 'botId is required');
	}

	const messages = validateMessages(rawMessages);
	let timezone: string;
	try {
		timezone = validateChatTimezone(rawTimezone);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'timezone is invalid');
	}

	const bot = getBotById(botId);
	if (!bot) {
		throw error(404, `Bot "${botId}" not found`);
	}

	const chatSession = createChatSession({
		bot,
		channels: loadChannels(),
		shows: loadGroups(),
		now: new Date(),
		timezone
	});

	if (!chatSession.allowed || !chatSession.systemPrompt) {
		throw error(chatSession.status, chatSession.reason ?? 'Chat is not available');
	}

	const spendConfig = {
		kv: env.KV,
		rateLimitPerHour: parseInt(env.RATE_LIMIT_PER_HOUR || '30')
	};

	const gate = await canRespond(spendConfig, ip);
	if (!gate.allowed) {
		throw error(429, gate.reason || 'Rate limited');
	}

	const providers = resolveLlmProviders(env);
	if (providers.length === 0) {
		throw error(503, 'No LLM providers are configured');
	}

	const stream = await streamCompletion({
		systemPrompt: chatSession.systemPrompt,
		messages,
		providers,
		kv: env.KV,
		options: { maxTokens: 300, temperature: 0.8 }
	});

	await recordMessage(env.KV, ip);

	const encoder = new TextEncoder();
	const sseStream = new ReadableStream({
		async start(controller) {
			const reader = stream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					if (value.type !== 'usage') {
						const data = `data: ${JSON.stringify(value)}\n\n`;
						controller.enqueue(encoder.encode(data));
					}

					if (value.usage) {
						try {
							await recordTokens(env.KV, value.usage);
						} catch (recordError) {
							console.error('[chat SSE] token accounting failed:', recordError);
						}
					}
				}
			} catch (e) {
				console.error('[chat SSE] stream error:', e);
				const errData = `data: ${JSON.stringify({ type: 'error', error: 'internal error' })}\n\n`;
				controller.enqueue(encoder.encode(errData));
			} finally {
				controller.close();
			}
		}
	});

	return new Response(sseStream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
