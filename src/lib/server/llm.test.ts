import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TextChunk } from '$lib/types';

// --- Anthropic mock ---
const mockAnthropicStreamOn = vi.fn();
const mockAnthropicMessagesStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			messages: {
				stream: mockAnthropicMessagesStream
			}
		}))
	};
});

// --- OpenAI mock ---
const mockOpenAIChatCompletionsCreate = vi.fn();

vi.mock('openai', () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockOpenAIChatCompletionsCreate
				}
			}
		}))
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
			expect(chunks[2]).toEqual({ type: 'done', tokenCount: 5 });
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
			expect(chunks[0]).toEqual({ type: 'error', error: 'internal error' });
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
			expect(chunks[0]).toEqual({ type: 'error', error: 'internal error' });
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
					usage: { completion_tokens: 7, prompt_tokens: 12, total_tokens: 19 }
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
			expect(chunks[2]).toEqual({ type: 'done', tokenCount: 7 });
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

			await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'openai',
				apiKey: 'test-key'
			});

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
			expect(chunks[0]).toEqual({ type: 'error', error: 'internal error' });
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

			await streamCompletion({
				systemPrompt: 'Test',
				messages: [{ role: 'user', content: 'Hi' }],
				provider: 'openai',
				apiKey: 'test-key'
			});

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
				options: { model: 'claude-3-5-sonnet-latest' },
				apiKey: 'test-key'
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(mockAnthropicMessagesStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'claude-3-5-sonnet-latest'
				})
			);
		});
	});
});
