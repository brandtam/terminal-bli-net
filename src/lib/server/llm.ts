import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatMessage, TextChunk } from '$lib/types';

const CLAUDE_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

interface StreamCompletionParams {
	systemPrompt: string;
	messages: ChatMessage[];
	provider?: 'claude' | 'openai';
	options?: {
		maxTokens?: number;
		temperature?: number;
		model?: string;
	};
	apiKey: string;
}

async function streamAnthropicCompletion(
	params: StreamCompletionParams
): Promise<ReadableStream<TextChunk>> {
	const { systemPrompt, messages, options, apiKey } = params;
	const model = options?.model ?? CLAUDE_DEFAULT_MODEL;
	const maxTokens = options?.maxTokens ?? 1024;
	const temperature = options?.temperature ?? 1.0;

	const client = new Anthropic({ apiKey });

	return new ReadableStream<TextChunk>({
		async start(controller) {
			try {
				const stream = client.messages.stream({
					model,
					max_tokens: maxTokens,
					temperature,
					system: [
						{
							type: 'text' as const,
							text: systemPrompt,
							cache_control: { type: 'ephemeral' as const }
						}
					],
					messages: messages.map((m) => ({
						role: m.role,
						content: m.content
					}))
				});

				let totalTokens = 0;

				stream.on('text', (textDelta) => {
					controller.enqueue({ type: 'text', text: textDelta });
				});

				stream.on('finalMessage', (message) => {
					totalTokens = message.usage.output_tokens;
				});

				stream.on('error', (error) => {
					console.error('[llm] Anthropic stream error:', error);
					controller.enqueue({
						type: 'error',
						error: 'internal error'
					});
					controller.close();
				});

				stream.on('end', () => {
					controller.enqueue({ type: 'done', tokenCount: totalTokens });
					controller.close();
				});
			} catch (err) {
				console.error('[llm] Anthropic completion error:', err);
				controller.enqueue({
					type: 'error',
					error: 'internal error'
				});
				controller.close();
			}
		}
	});
}

async function streamOpenAICompletion(
	params: StreamCompletionParams
): Promise<ReadableStream<TextChunk>> {
	const { systemPrompt, messages, options, apiKey } = params;
	const model = options?.model ?? OPENAI_DEFAULT_MODEL;
	const maxTokens = options?.maxTokens ?? 1024;
	const temperature = options?.temperature ?? 1.0;

	const client = new OpenAI({ apiKey });

	return new ReadableStream<TextChunk>({
		async start(controller) {
			try {
				const stream = await client.chat.completions.create({
					model,
					max_tokens: maxTokens,
					temperature,
					stream: true,
					stream_options: { include_usage: true },
					messages: [
						{ role: 'system' as const, content: systemPrompt },
						...messages.map((m) => ({
							role: m.role as 'user' | 'assistant',
							content: m.content
						}))
					]
				});

				let totalTokens = 0;

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (delta?.content) {
						controller.enqueue({ type: 'text', text: delta.content });
					}

					if (chunk.usage) {
						totalTokens = chunk.usage.completion_tokens;
					}
				}

				controller.enqueue({ type: 'done', tokenCount: totalTokens });
				controller.close();
			} catch (err) {
				console.error('[llm] OpenAI completion error:', err);
				controller.enqueue({
					type: 'error',
					error: 'internal error'
				});
				controller.close();
			}
		}
	});
}

export function streamCompletion(params: StreamCompletionParams): Promise<ReadableStream<TextChunk>> {
	const provider = params.provider ?? 'claude';

	if (provider === 'openai') {
		return streamOpenAICompletion(params);
	}

	return streamAnthropicCompletion(params);
}
