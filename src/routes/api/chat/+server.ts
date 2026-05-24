import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamCompletion } from '$lib/server/llm';
import { canRespond, recordTokens, recordMessage } from '$lib/server/spend';
import { getBotById } from '$lib/server/bots';
import type { ChatMessage } from '$lib/types';

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
	if (!platform?.env) {
		throw error(500, 'Platform bindings not available');
	}

	const env = platform.env;
	const ip = getClientAddress();

	const body = await request.json();
	const { botId, messages, sessionId, sessionMessageCount } = body as {
		botId: string;
		messages: ChatMessage[];
		sessionId: string;
		sessionMessageCount: number;
	};

	if (!botId || !messages || !Array.isArray(messages)) {
		throw error(400, 'Missing required fields');
	}

	const bot = getBotById(botId);
	if (!bot) {
		throw error(404, `Bot "${botId}" not found`);
	}

	const systemPrompt = bot.prompt;

	const spendConfig = {
		kv: env.KV,
		monthlyCap: parseInt(env.MONTHLY_SPEND_CAP || '50'),
		rateLimitPerHour: parseInt(env.RATE_LIMIT_PER_HOUR || '30'),
		sessionCap: parseInt(env.SESSION_MESSAGE_CAP || '50')
	};

	const gate = await canRespond(spendConfig, ip, sessionId, sessionMessageCount);
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

	await recordMessage(env.KV, ip);

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
