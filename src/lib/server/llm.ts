/* eslint-disable no-undef */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatMessage, LlmProvider, LlmTokenUsage, TextChunk } from '$lib/types';
import { getModelPricing, isProviderOverBudget } from './spend';

const CLAUDE_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';
const MID_STREAM_RETRY_NOTICE =
	'\n\n[signal drops for a beat]\n\nOops, brain fart... let me try that again.\n\n';

export interface LlmProviderConfig {
	provider: LlmProvider;
	apiKey: string;
	model?: string;
	monthlyBudget?: number;
}

export interface StreamCompletionParams {
	systemPrompt: string;
	messages: ChatMessage[];
	provider?: LlmProvider;
	providers?: LlmProviderConfig[];
	options?: {
		maxTokens?: number;
		temperature?: number;
		model?: string;
	};
	apiKey?: string;
	kv?: KVNamespace;
}

interface ProviderAttempt {
	provider: LlmProvider;
	model: string;
	apiKey: string;
	monthlyBudget?: number;
}

interface ProviderStreamParams {
	systemPrompt: string;
	messages: ChatMessage[];
	provider: LlmProvider;
	model: string;
	apiKey: string;
	options?: {
		maxTokens?: number;
		temperature?: number;
	};
}

function defaultModelFor(provider: LlmProvider): string {
	return provider === 'openai' ? OPENAI_FALLBACK_MODEL : CLAUDE_FALLBACK_MODEL;
}

function isRetryableProviderError(err: unknown): boolean {
	const status =
		typeof err === 'object' && err !== null && 'status' in err
			? Number((err as { status?: unknown }).status)
			: NaN;
	if (status === 429 || (status >= 500 && status <= 599)) return true;

	const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
	return (
		message.includes('429') ||
		message.includes('rate limit') ||
		message.includes('overload') ||
		message.includes('temporarily unavailable')
	);
}

function toErrorChunk(err: unknown): TextChunk {
	return {
		type: 'error',
		error: 'internal error',
		retryable: isRetryableProviderError(err)
	};
}

function tokenCountForUsage(usage: LlmTokenUsage): number {
	return (
		usage.inputTokens +
		usage.outputTokens +
		(usage.cacheCreationInputTokens ?? 0) +
		(usage.cacheReadInputTokens ?? 0)
	);
}

function usageChunk(usage: LlmTokenUsage): TextChunk {
	return {
		type: 'done',
		tokenCount: tokenCountForUsage(usage),
		usage
	};
}

function usageOnlyChunk(usage: LlmTokenUsage): TextChunk {
	return {
		type: 'usage',
		tokenCount: tokenCountForUsage(usage),
		usage
	};
}

function estimateTokens(text: string): number {
	const normalized = text.trim();
	if (!normalized) return 0;
	return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateFailedStreamUsage(
	params: StreamCompletionParams,
	attempt: ProviderAttempt,
	outputText: string
): LlmTokenUsage | null {
	const outputTokens = estimateTokens(outputText);
	if (outputTokens === 0) return null;

	const inputText = [
		params.systemPrompt,
		...params.messages.map((message) => `${message.role}: ${message.content}`)
	].join('\n');

	return {
		provider: attempt.provider,
		model: attempt.model,
		inputTokens: estimateTokens(inputText),
		outputTokens,
		estimated: true
	};
}

function resolveProviderAttempts(params: StreamCompletionParams): ProviderAttempt[] {
	if (params.providers?.length) {
		return params.providers.map((providerConfig) => {
			const model = providerConfig.model ?? defaultModelFor(providerConfig.provider);
			getModelPricing(model);
			return { ...providerConfig, model };
		});
	}

	const provider = params.provider ?? 'claude';
	if (!params.apiKey) {
		throw new Error(`API key not configured for provider "${provider}"`);
	}
	const model = params.options?.model ?? defaultModelFor(provider);
	getModelPricing(model);
	return [{ provider, apiKey: params.apiKey, model }];
}

async function streamAnthropicCompletion(
	params: ProviderStreamParams
): Promise<ReadableStream<TextChunk>> {
	const { systemPrompt, messages, options, apiKey, model, provider } = params;
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

				let usage: LlmTokenUsage = {
					provider,
					model,
					inputTokens: 0,
					outputTokens: 0
				};

				stream.on('text', (textDelta) => {
					controller.enqueue({ type: 'text', text: textDelta });
				});

				stream.on('finalMessage', (message) => {
					const usageDetails = message.usage as {
						input_tokens?: number;
						output_tokens?: number;
						cache_creation_input_tokens?: number;
						cache_read_input_tokens?: number;
					};
					usage = {
						provider,
						model,
						inputTokens: usageDetails.input_tokens ?? 0,
						outputTokens: usageDetails.output_tokens ?? 0,
						cacheCreationInputTokens: usageDetails.cache_creation_input_tokens || undefined,
						cacheReadInputTokens: usageDetails.cache_read_input_tokens || undefined
					};
				});

				stream.on('error', (error) => {
					console.error('[llm] Anthropic stream error:', error);
					controller.enqueue(toErrorChunk(error));
					controller.close();
				});

				stream.on('end', () => {
					controller.enqueue(usageChunk(usage));
					controller.close();
				});
			} catch (err) {
				console.error('[llm] Anthropic completion error:', err);
				controller.enqueue(toErrorChunk(err));
				controller.close();
			}
		}
	});
}

async function streamOpenAICompletion(
	params: ProviderStreamParams
): Promise<ReadableStream<TextChunk>> {
	const { systemPrompt, messages, options, apiKey, model, provider } = params;
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

				let usage: LlmTokenUsage = {
					provider,
					model,
					inputTokens: 0,
					outputTokens: 0
				};

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta;
					if (delta?.content) {
						controller.enqueue({ type: 'text', text: delta.content });
					}

					if (chunk.usage) {
						const cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
						usage = {
							provider,
							model,
							inputTokens: Math.max(0, (chunk.usage.prompt_tokens ?? 0) - cachedTokens),
							cacheReadInputTokens: cachedTokens || undefined,
							outputTokens: chunk.usage.completion_tokens ?? 0
						};
					}
				}

				controller.enqueue(usageChunk(usage));
				controller.close();
			} catch (err) {
				console.error('[llm] OpenAI completion error:', err);
				controller.enqueue(toErrorChunk(err));
				controller.close();
			}
		}
	});
}

function streamProviderCompletion(
	params: ProviderStreamParams
): Promise<ReadableStream<TextChunk>> {
	if (params.provider === 'openai') {
		return streamOpenAICompletion(params);
	}

	return streamAnthropicCompletion(params);
}

async function isAttemptAvailable(
	attempt: ProviderAttempt,
	kv: KVNamespace | undefined
): Promise<boolean> {
	if (!kv || attempt.monthlyBudget === undefined) return true;
	return !(await isProviderOverBudget(kv, attempt.provider, attempt.monthlyBudget));
}

async function nextAvailableAttempt(
	attempts: ProviderAttempt[],
	startIndex: number,
	kv: KVNamespace | undefined
): Promise<{ attempt: ProviderAttempt; index: number } | null> {
	for (let i = startIndex; i < attempts.length; i += 1) {
		const attempt = attempts[i];
		if (await isAttemptAvailable(attempt, kv)) {
			return { attempt, index: i };
		}
	}
	return null;
}

type PipeResult = 'success' | 'retry-pre-token' | 'fatal-pre-token' | 'retry-mid-stream' | 'stop';

async function pipeProviderAttempt(
	controller: ReadableStreamDefaultController<TextChunk>,
	params: StreamCompletionParams,
	attempt: ProviderAttempt,
	stopOnProviderError: boolean
): Promise<PipeResult> {
	const stream = await streamProviderCompletion({
		systemPrompt: params.systemPrompt,
		messages: params.messages,
		provider: attempt.provider,
		model: attempt.model,
		apiKey: attempt.apiKey,
		options: params.options
	});
	const reader = stream.getReader();
	let emittedText = false;
	let emittedTextBuffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) return 'stop';

		if (value.type === 'error') {
			if (emittedText) {
				const usage = value.usage ?? estimateFailedStreamUsage(params, attempt, emittedTextBuffer);
				if (usage) {
					controller.enqueue(usageOnlyChunk(usage));
				}
			}
			if (value.retryable && !emittedText && !stopOnProviderError) {
				return 'retry-pre-token';
			}
			if (value.retryable && emittedText && !stopOnProviderError) {
				return 'retry-mid-stream';
			}
			if (stopOnProviderError && !emittedText) {
				return 'stop';
			}
			if (!emittedText) {
				controller.enqueue({ type: 'error', error: 'LLM provider unavailable' });
				return 'fatal-pre-token';
			}
			return 'stop';
		}

		if (value.type === 'text') {
			emittedText = true;
			emittedTextBuffer += value.text ?? '';
		}

		controller.enqueue(value);
		if (value.type === 'done') {
			return 'success';
		}
	}
}

export async function streamCompletion(
	params: StreamCompletionParams
): Promise<ReadableStream<TextChunk>> {
	const attempts = resolveProviderAttempts(params);

	return new ReadableStream<TextChunk>({
		async start(controller) {
			let nextIndex = 0;

			while (true) {
				const next = await nextAvailableAttempt(attempts, nextIndex, params.kv);
				if (!next) {
					controller.enqueue({
						type: 'error',
						error: 'All LLM providers are unavailable or over budget'
					});
					controller.close();
					return;
				}

				const result = await pipeProviderAttempt(controller, params, next.attempt, false);
				if (result === 'success' || result === 'fatal-pre-token' || result === 'stop') {
					controller.close();
					return;
				}

				if (result === 'retry-mid-stream') {
					controller.enqueue({ type: 'text', text: MID_STREAM_RETRY_NOTICE });
					const retry = await nextAvailableAttempt(attempts, next.index + 1, params.kv);
					if (retry) {
						await pipeProviderAttempt(controller, params, retry.attempt, true);
					}
					controller.close();
					return;
				}

				nextIndex = next.index + 1;
			}
		}
	});
}
