import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamCompletion } from '$lib/server/llm';
import { canRespond, recordTokens, recordMessage } from '$lib/server/spend';
import { getBotById, loadChannels, loadGroups } from '$lib/server/bots';
import { buildSystemPrompt } from '$lib/server/prompt';
import type { ChatMessage } from '$lib/types';

const VALID_ROLES = new Set(['user', 'assistant']);
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;
const SESSION_ID_RE = /^[a-f0-9-]{36}$/;

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

	const { botId, messages: rawMessages, sessionId } = body as Record<string, unknown>;

	if (typeof botId !== 'string' || !botId) {
		throw error(400, 'botId is required');
	}
	if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
		throw error(400, 'sessionId must be a valid UUID');
	}

	const messages = validateMessages(rawMessages);

	const bot = getBotById(botId);
	if (!bot) {
		throw error(404, `Bot "${botId}" not found`);
	}

	const systemPrompt = buildSystemPrompt(
		bot.prompt,
		bot.group,
		loadChannels(),
		loadGroups(),
		new Date()
	);

	const spendConfig = {
		kv: env.KV,
		monthlyCap: parseInt(env.MONTHLY_SPEND_CAP || '50'),
		rateLimitPerHour: parseInt(env.RATE_LIMIT_PER_HOUR || '30'),
		sessionCap: parseInt(env.SESSION_MESSAGE_CAP || '50')
	};

	// Session message count is tracked server-side per IP, not client-supplied
	const gate = await canRespond(spendConfig, ip, sessionId);
	if (!gate.allowed) {
		throw error(429, gate.reason || 'Rate limited');
	}

	const provider = (env.PROVIDER as 'claude' | 'openai') || 'claude';
	const apiKey = provider === 'claude' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;

	if (!apiKey) {
		throw error(500, `API key not configured for provider "${provider}"`);
	}

	const stream = await streamCompletion({
		systemPrompt,
		messages,
		provider,
		apiKey,
		options: { maxTokens: 300, temperature: 0.8 }
	});

	await recordMessage(env.KV, ip, sessionId);

	const encoder = new TextEncoder();
	const sseStream = new ReadableStream({
		async start(controller) {
			const reader = stream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const data = `data: ${JSON.stringify(value)}\n\n`;
					controller.enqueue(encoder.encode(data));

					if (value.type === 'done' && value.tokenCount) {
						await recordTokens(env.KV, value.tokenCount);
					}
				}
			} catch (e) {
				const errData = `data: ${JSON.stringify({ type: 'error', error: String(e) })}\n\n`;
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
