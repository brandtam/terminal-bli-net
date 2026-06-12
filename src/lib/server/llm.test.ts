import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TextChunk } from '$lib/types';

// --- Anthropic mock ---
const mockAnthropicMessagesStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
	return {
		default: vi.fn().mockImplementation(function () {
			return {
				messages: {
					stream: mockAnthropicMessagesStream
				}
			};
		})
	};
});

// --- OpenAI mock ---
const mockOpenAIChatCompletionsCreate = vi.fn();

vi.mock('openai', () => {
	return {
		default: vi.fn().mockImplementation(function () {
			return {
				chat: {
					completions: {
						create: mockOpenAIChatCompletionsCreate
					}
				}
			};
		})
	};
});

// Helper to collect all chunks from a ReadableStream
async function collectChunks(stream: ReadableStream<TextChunk>): Promise<TextChunk[]> {
	const reader = stream.getReader();
	const chunks: TextChunk[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	return chunks;
}

describe('streamCompletion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAnthropicMessagesStream.mockReset();
		mockOpenAIChatCompletionsCreate.mockReset();
	});

	describe('AnthropicProvider', () => {
		it('produces correct stream shape with text and done chunks', async () => {
			// Set up the mock to capture event handlers and fire them
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			// We need to import after mocks are set up
			const { streamCompletion } = await import('./llm');

			const streamPromise = streamCompletion({
				systemPrompt: 'You are a test bot.',
				messages: [{ role: 'user', content: 'Hello' }],
				provider: 'claude',
				apiKey: 'test-anthropic-key'
			});

			const stream = await streamPromise;

			// Fire event handlers to simulate streaming
			// The handlers are registered in the ReadableStream start() which runs synchronously
			// We need to wait a tick for the start() to execute
			await new Promise((r) => setTimeout(r, 0));

			// Simulate text events
			for (const h of handlers['text'] ?? []) h('Hello');
			for (const h of handlers['text'] ?? []) h(' world');

			// Simulate finalMessage
			for (const h of handlers['finalMessage'] ?? [])
				h({ usage: { output_tokens: 5, input_tokens: 10 } });

			// Simulate end
			for (const h of handlers['end'] ?? []) h();

			const chunks = await collectChunks(stream);

			expect(chunks).toHaveLength(3);
			expect(chunks[0]).toEqual({ type: 'text', text: 'Hello' });
			expect(chunks[1]).toEqual({ type: 'text', text: ' world' });
			expect(chunks[2]).toEqual({
				type: 'done',
				tokenCount: 15,
				usage: {
					provider: 'claude',
					model: 'claude-haiku-4-5-20251001',
					inputTokens: 10,
					outputTokens: 5
				}
			});
		});

		it('uses prompt caching for the system prompt', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			await streamCompletion({
				systemPrompt: 'You are a character.',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(mockAnthropicMessagesStream).toHaveBeenCalledWith(
				expect.objectContaining({
					system: [
						{
							type: 'text',
							text: 'You are a character.',
							cache_control: { type: 'ephemeral' }
						}
					]
				})
			);
		});

		it('includes Anthropic prompt-cache usage fields in the done chunk', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'You are a cached character.',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));
			for (const h of handlers['finalMessage'] ?? [])
				h({
					usage: {
						input_tokens: 12,
						output_tokens: 6,
						cache_creation_input_tokens: 100,
						cache_read_input_tokens: 200
					}
				});
			for (const h of handlers['end'] ?? []) h();

			const chunks = await collectChunks(stream);
			expect(chunks).toEqual([
				{
					type: 'done',
					tokenCount: 318,
					usage: {
						provider: 'claude',
						model: 'claude-haiku-4-5-20251001',
						inputTokens: 12,
						outputTokens: 6,
						cacheCreationInputTokens: 100,
						cacheReadInputTokens: 200
					}
				}
			]);
		});

		it('uses default model claude-haiku-4-5-20251001', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(mockAnthropicMessagesStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-haiku-4-5-20251001'
				})
			);
		});

		it('handles errors gracefully', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			// Simulate error event
			for (const h of handlers['error'] ?? []) h(new Error('API rate limit'));

			const chunks = await collectChunks(stream);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toEqual({
				type: 'error',
				error: 'All LLM providers are unavailable'
			});
		});

		it('handles constructor errors', async () => {
			mockAnthropicMessagesStream.mockImplementation(() => {
				throw new Error('Invalid API key');
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				apiKey: 'bad-key'
			});

			const chunks = await collectChunks(stream);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toEqual({ type: 'error', error: 'LLM provider unavailable' });
		});
	});

	describe('OpenAIProvider', () => {
		it('produces correct stream shape with text and done chunks', async () => {
			// Create an async iterable that simulates OpenAI streaming
			const mockChunks = [
				{
					choices: [{ delta: { content: 'Hello' }, finish_reason: null, index: 0 }],
					usage: null
				},
				{
					choices: [{ delta: { content: ' world' }, finish_reason: null, index: 0 }],
					usage: null
				},
				{
					choices: [{ delta: {}, finish_reason: 'stop', index: 0 }],
					usage: null
				},
				{
					choices: [],
					usage: {
						completion_tokens: 7,
						prompt_tokens: 12,
						total_tokens: 19,
						prompt_tokens_details: { cached_tokens: 4 }
					}
				}
			];

			mockOpenAIChatCompletionsCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					for (const chunk of mockChunks) {
						yield chunk;
					}
				}
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'You are a test bot.',
				messages: [{ role: 'user', content: 'Hello' }],
				provider: 'openai',
				apiKey: 'test-openai-key'
			});

			const chunks = await collectChunks(stream);

			expect(chunks).toHaveLength(3);
			expect(chunks[0]).toEqual({ type: 'text', text: 'Hello' });
			expect(chunks[1]).toEqual({ type: 'text', text: ' world' });
			expect(chunks[2]).toEqual({
				type: 'done',
				tokenCount: 19,
				usage: {
					provider: 'openai',
					model: 'gpt-4o-mini',
					inputTokens: 8,
					cacheReadInputTokens: 4,
					outputTokens: 7
				}
			});
		});

		it('uses default model gpt-4o-mini', async () => {
			mockOpenAIChatCompletionsCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop', index: 0 }],
						usage: { completion_tokens: 1, prompt_tokens: 5, total_tokens: 6 }
					};
				}
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'openai',
				apiKey: 'test-key'
			});
			await collectChunks(stream);

			expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'gpt-4o-mini'
				})
			);
		});

		it('handles errors gracefully', async () => {
			mockOpenAIChatCompletionsCreate.mockRejectedValue(new Error('OpenAI API error'));

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'openai',
				apiKey: 'bad-key'
			});

			const chunks = await collectChunks(stream);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toEqual({ type: 'error', error: 'LLM provider unavailable' });
		});
	});

	describe('Provider selection', () => {
		it('defaults to claude when no provider specified', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(mockAnthropicMessagesStream).toHaveBeenCalled();
			expect(mockOpenAIChatCompletionsCreate).not.toHaveBeenCalled();
		});

		it('selects openai when provider is openai', async () => {
			mockOpenAIChatCompletionsCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop', index: 0 }],
						usage: { completion_tokens: 1, prompt_tokens: 5, total_tokens: 6 }
					};
				}
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'openai',
				apiKey: 'test-key'
			});
			await collectChunks(stream);

			expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalled();
			expect(mockAnthropicMessagesStream).not.toHaveBeenCalled();
		});

		it('respects custom model override', async () => {
			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'claude',
				options: { model: 'claude-sonnet-4-6' },
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(mockAnthropicMessagesStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-sonnet-4-6'
				})
			);
		});
	});

	describe('Fallback client', () => {
		it('falls back when the primary provider fails before any tokens stream', async () => {
			mockOpenAIChatCompletionsCreate.mockRejectedValue(
				Object.assign(new Error('rate limit'), { status: 429 })
			);

			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				providers: [
					{ provider: 'openai', apiKey: 'openai-key', model: 'gpt-4o-mini' },
					{ provider: 'claude', apiKey: 'anthropic-key', model: 'claude-haiku-4-5-20251001' }
				]
			});
			const chunksPromise = collectChunks(stream);

			await new Promise((r) => setTimeout(r, 0));
			for (const h of handlers['text'] ?? []) h('Fallback works');
			for (const h of handlers['finalMessage'] ?? [])
				h({ usage: { input_tokens: 10, output_tokens: 2 } });
			for (const h of handlers['end'] ?? []) h();

			const chunks = await chunksPromise;
			expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalled();
			expect(mockAnthropicMessagesStream).toHaveBeenCalled();
			expect(chunks).toEqual([
				{ type: 'text', text: 'Fallback works' },
				{
					type: 'done',
					tokenCount: 12,
					usage: {
						provider: 'claude',
						model: 'claude-haiku-4-5-20251001',
						inputTokens: 10,
						outputTokens: 2
					}
				}
			]);
		});

		it('keeps partial text, appends a notice, and retries once after mid-stream failure', async () => {
			mockOpenAIChatCompletionsCreate.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: 'Partial answer.' }, finish_reason: null, index: 0 }],
						usage: null
					};
					throw Object.assign(new Error('overload'), { status: 503 });
				}
			});

			const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
			mockAnthropicMessagesStream.mockReturnValue({
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!handlers[event]) handlers[event] = [];
					handlers[event].push(handler);
				})
			});

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				providers: [
					{ provider: 'openai', apiKey: 'openai-key', model: 'gpt-4o-mini' },
					{ provider: 'claude', apiKey: 'anthropic-key', model: 'claude-haiku-4-5-20251001' }
				]
			});
			const chunksPromise = collectChunks(stream);

			await new Promise((r) => setTimeout(r, 0));
			for (const h of handlers['text'] ?? []) h('Fresh answer.');
			for (const h of handlers['finalMessage'] ?? [])
				h({ usage: { input_tokens: 6, output_tokens: 2 } });
			for (const h of handlers['end'] ?? []) h();

			const chunks = await chunksPromise;
			expect(chunks[0]).toEqual({ type: 'text', text: 'Partial answer.' });
			expect(chunks[1]).toMatchObject({
				type: 'usage',
				usage: {
					provider: 'openai',
					model: 'gpt-4o-mini',
					estimated: true
				}
			});
			expect(chunks[2]).toMatchObject({ type: 'text' });
			expect(chunks[2].text).toContain('Oops, brain fart');
			expect(chunks[3]).toEqual({ type: 'text', text: 'Fresh answer.' });
			expect(chunks[4]).toMatchObject({
				type: 'done',
				usage: { provider: 'claude', model: 'claude-haiku-4-5-20251001' }
			});
		});

		it('keeps partial text and notice when the mid-stream retry fails before text', async () => {
			mockOpenAIChatCompletionsCreate
				.mockResolvedValueOnce({
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [{ delta: { content: 'Partial answer.' }, finish_reason: null, index: 0 }],
							usage: null
						};
						throw Object.assign(new Error('overload'), { status: 503 });
					}
				})
				.mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }));

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				providers: [
					{ provider: 'openai', apiKey: 'primary-key', model: 'gpt-4o-mini' },
					{ provider: 'openai', apiKey: 'secondary-key', model: 'gpt-4o-mini' }
				]
			});

			const chunks = await collectChunks(stream);
			expect(chunks[0]).toEqual({ type: 'text', text: 'Partial answer.' });
			expect(chunks[1]).toMatchObject({
				type: 'usage',
				usage: { provider: 'openai', model: 'gpt-4o-mini', estimated: true }
			});
			expect(chunks[2]).toMatchObject({ type: 'text' });
			expect(chunks[2].text).toContain('Oops, brain fart');
			expect(chunks).toHaveLength(3);
		});

		it('returns a clean error when every provider attempt fails with a transient error', async () => {
			mockOpenAIChatCompletionsCreate.mockRejectedValue(
				Object.assign(new Error('rate limit'), { status: 429 })
			);

			const { streamCompletion } = await import('./llm');

			const stream = await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				providers: [{ provider: 'openai', apiKey: 'openai-key', model: 'gpt-4o-mini' }]
			});

			const chunks = await collectChunks(stream);
			expect(chunks).toEqual([{ type: 'error', error: 'All LLM providers are unavailable' }]);
		});
	});
});
