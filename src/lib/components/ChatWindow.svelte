<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import type { Bot, ChatMessage, TextChunk } from '$lib/types';
	import { loadConversations, saveConversation, getSessionId } from '$lib/persistence';
	import { formatTimeUntil } from '$lib/schedule';

	let {
		bot,
		minutesLeft = null,
		offAir = false
	}: {
		bot: Bot;
		minutesLeft: number | null;
		offAir?: boolean;
	} = $props();

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let busy = $state(false);
	let streamingText = $state('');
	let logEl: HTMLDivElement | undefined = $state();
	let messageCount = $state(0);

	onMount(() => {
		const saved = loadConversations()[bot.id];
		if (saved) {
			messages = saved.messages;
			messageCount = messages.filter((m) => m.role === 'user').length;
		}
	});

	function scrollToBottom() {
		if (logEl) {
			requestAnimationFrame(() => {
				if (logEl) logEl.scrollTop = logEl.scrollHeight;
			});
		}
	}

	$effect(() => {
		if (messages.length || streamingText) {
			scrollToBottom();
		}
	});

	async function send() {
		const text = input.trim();
		if (!text || busy) return;
		input = '';
		busy = true;
		streamingText = '';
		messageCount++;

		const userMsg: ChatMessage = { role: 'user', content: text };
		messages = [...messages, userMsg];

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					botId: bot.id,
					messages: messages.slice(-20),
					sessionId: getSessionId(),
					sessionMessageCount: messageCount
				})
			});

			if (!response.ok) {
				const err = await response.text();
				messages = [...messages, { role: 'assistant', content: `[Error: ${err}]` }];
				busy = false;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No stream');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const chunk: TextChunk = JSON.parse(line.slice(6));
					if (chunk.type === 'text' && chunk.text) {
						streamingText += chunk.text;
					} else if (chunk.type === 'done') {
						messages = [
							...messages,
							{ role: 'assistant', content: streamingText }
						];
						streamingText = '';
					} else if (chunk.type === 'error') {
						messages = [
							...messages,
							{ role: 'assistant', content: `[Error: ${chunk.error}]` }
						];
						streamingText = '';
					}
				}
			}

			if (streamingText) {
				messages = [...messages, { role: 'assistant', content: streamingText }];
				streamingText = '';
			}
		} catch (e) {
			messages = [
				...messages,
				{ role: 'assistant', content: `[Connection error: ${e}]` }
			];
		} finally {
			busy = false;
			saveConversation(bot.id, {
				botId: bot.id,
				group: bot.group,
				messages,
				updatedAt: Date.now()
			});
		}
	}

	function renderMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string;
	}
</script>

<div class="chat-container">
	<div class="chat-header">
		<div class="chat-avatar">
			{bot.name
				.split(' ')
				.map((w) => w[0])
				.join('')
				.slice(0, 2)}
		</div>
		<div class="who">
			<span class="name">{bot.name.toUpperCase()}</span>
			<small>{bot.occupation}</small>
		</div>
		{#if minutesLeft !== null}
			<span class="countdown">{formatTimeUntil(minutesLeft)} left</span>
		{/if}
	</div>

	<div class="chat-log" bind:this={logEl}>
		<div class="bubble system">
			— {bot.greeting} —
		</div>
		{#each messages as m, i}
			{#if m.role === 'user'}
				<div class="bubble user">
					<span class="who-label">YOU</span>
					{m.content}
				</div>
			{:else}
				<div class="bubble bot">
					<span class="who-label">{bot.name.toUpperCase()}</span>
					{@html renderMarkdown(m.content)}
				</div>
			{/if}
		{/each}
		{#if streamingText}
			<div class="bubble bot streaming">
				<span class="who-label">{bot.name.toUpperCase()}</span>
				{@html renderMarkdown(streamingText)}
			</div>
		{/if}
		{#if busy && !streamingText}
			<div class="bubble bot typing">
				<span class="who-label">{bot.name.toUpperCase()} is typing</span>
				<span class="dot">●</span><span class="dot">●</span><span class="dot">●</span>
			</div>
		{/if}
	</div>

	{#if offAir}
		<div class="off-air-banner">
			{bot.name.toUpperCase()} has gone off air. Check the TV Guide for what's on now.
		</div>
	{/if}

	<form class="chat-input" onsubmit={(e) => { e.preventDefault(); send(); }}>
		<input
			bind:value={input}
			placeholder={offAir ? `${bot.name} is off air` : busy ? 'typing...' : `say something to ${bot.name}...`}
			disabled={busy || offAir}
		/>
		<button type="submit" disabled={busy || offAir}>{offAir ? 'OFF AIR' : busy ? '...' : 'SEND'}</button>
	</form>
</div>

<style>
	.chat-container {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.chat-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 2px solid var(--ink);
		background: var(--paper-soft);
		flex-shrink: 0;
	}
	.chat-avatar {
		width: 36px;
		height: 36px;
		border: 2px solid var(--ink);
		background: var(--accent-2);
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.who {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		line-height: 1.4;
	}
	.who small {
		display: block;
		font-family: 'VT323', monospace;
		font-size: 15px;
		margin-top: 4px;
		opacity: 0.75;
	}
	.countdown {
		margin-left: auto;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		color: var(--accent);
	}
	.chat-log {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--paper);
		font-family: 'VT323', monospace;
		font-size: 19px;
		line-height: 1.3;
	}
	.bubble {
		max-width: 85%;
		padding: 8px 10px;
		border: 2px solid var(--ink);
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.bubble :global(p) {
		margin: 0 0 4px;
	}
	.bubble :global(p:last-child) {
		margin: 0;
	}
	.who-label {
		display: block;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		margin-bottom: 4px;
		opacity: 0.7;
	}
	.bubble.user {
		align-self: flex-end;
		background: var(--accent-2);
	}
	.bubble.bot {
		align-self: flex-start;
		background: var(--paper);
	}
	.bubble.system {
		align-self: center;
		background: var(--paper-soft);
		font-style: italic;
		max-width: 95%;
		text-align: center;
		font-size: 16px;
	}
	.bubble.typing {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
	}
	.dot {
		display: inline-block;
		animation: blink 1s steps(2, end) infinite;
	}
	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}
	.chat-input {
		display: flex;
		border-top: 2px solid var(--ink);
		background: var(--paper-soft);
		flex-shrink: 0;
	}
	.chat-input input {
		flex: 1;
		border: none;
		background: var(--paper);
		padding: 10px 12px;
		font-family: 'VT323', monospace;
		font-size: 19px;
		outline: none;
	}
	.chat-input button {
		border: none;
		border-left: 2px solid var(--ink);
		background: var(--accent);
		color: var(--paper);
		padding: 0 16px;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		cursor: pointer;
		letter-spacing: 1px;
	}
	.chat-input button:hover {
		background: var(--ink);
	}
	.chat-input button:disabled {
		background: var(--paper-soft);
		color: var(--ink);
		cursor: not-allowed;
	}
	.off-air-banner {
		padding: 8px 12px;
		background: var(--ink);
		color: var(--accent-2);
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 0.03em;
		line-height: 1.4;
		text-align: center;
		flex-shrink: 0;
	}
</style>
