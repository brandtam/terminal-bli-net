<script lang="ts">
	import { onMount } from 'svelte';
	import type { ChatMessage, TextChunk } from '$lib/types';
	import { loadConversations, saveConversation, getSessionId } from '$lib/persistence';
	import { formatTimeUntil, isShowOnAir, minutesUntilSlotEnd } from '$lib/schedule';
	import { getAppContext } from '$lib/os/os-context';
	import Dropdown from './Dropdown.svelte';

	type ChatMode = 'group' | string; // 'group' or a botId

	// Zero-prop window-host app (Slice 4). The show identity comes from the
	// window-id (`chat:<slug>` → ctx.window.args.slug). Everything else — the cast and
	// the ticking on-air state — is derived off the live OS, so a window left
	// open keeps counting down as os.now advances. No props bag ever freezes it.
	const { os, window: appWindow } = getAppContext();
	const showSlug = appWindow.args.slug ?? '';

	const group = $derived(os.groups.find((g) => g.slug === showSlug));
	const showName = $derived(group?.name ?? 'Chat');
	const castBots = $derived(os.bots.filter((b) => b.group === showSlug));
	const onAir = $derived(isShowOnAir(showSlug, os.channels, os.now, os.timezone));
	const minutesLeft = $derived(onAir ? minutesUntilSlotEnd(os.now, os.timezone) : null);
	const offAir = $derived(!onAir);

	let chatMode = $state<ChatMode>('group');

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let busy = $state(false);
	let streamingText = $state('');
	let streamingBotName = $state('');
	let logEl: HTMLDivElement | undefined = $state();
	let messageCount = $state(0);

	const modeOptions = $derived([
		{ value: 'group', label: 'Group Chat' },
		...castBots.map((b) => ({ value: b.id, label: b.name }))
	]);

	const castNames = $derived(castBots.map((b) => b.name.split(' ')[0]).join(' · '));

	const showInitials = $derived(
		showName
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
	);

	const inputPlaceholder = $derived.by(() => {
		if (offAir) return `${showName} is off air`;
		if (busy) return 'typing...';
		if (chatMode === 'group') return `say something to the room (${showName})...`;
		const bot = castBots.find((b) => b.id === chatMode);
		return bot ? `say something to ${bot.name}...` : `say something...`;
	});

	onMount(() => {
		// Kick off the markdown parser + sanitizer load on first mount; the
		// template re-renders bot bubbles through marked once they resolve.
		void loadMarkdownLibs();
		const saved = loadConversations()[showSlug];
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

	const EXCUSES = [
		'Sorry, I got distracted by something off-camera.',
		"Hold on, someone's knocking at the door.",
		'I just remembered I left something in the oven.',
		'The phone is ringing, give me a second.',
		'I think I hear my mother calling.',
		'Wait — what year is it again?',
		'My brain just did that thing where it completely shuts off.',
		'I spaced out, can you say that again later?',
		"I'm having a moment, just... give me a minute.",
		'Something came up, I gotta deal with this real quick.',
		'I just got paged, hold that thought.',
		"There's some kind of situation happening over here.",
		'Excuse me, I need to take this call.',
		'I completely lost my train of thought.',
		"The signal's bad, I'm getting static.",
		'Can we pick this up in a minute? Something just came up.',
		"I think we're experiencing technical difficulties.",
		'Hang on, the studio lights just went out.',
		'Sorry, the teleprompter is broken.',
		"We're on a commercial break, be right back."
	];

	function randomExcuse(): string {
		return EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
	}

	/** Parse `[Name] content` prefix from assistant messages */
	function parseResponder(content: string): { name: string | null; text: string } {
		const match = content.match(/^\[([^\]]+)\]\s*/);
		if (match) {
			return { name: match[1], text: content.slice(match[0].length) };
		}
		return { name: null, text: content };
	}

	async function send() {
		const text = input.trim();
		if (!text || busy) return;
		input = '';
		busy = true;
		streamingText = '';
		messageCount++;

		// Pick which bot responds
		const respondingBot =
			chatMode === 'group'
				? castBots[Math.floor(Math.random() * castBots.length)]
				: (castBots.find((b) => b.id === chatMode) ?? castBots[0]);

		streamingBotName = respondingBot.name;

		const userMsg: ChatMessage = { role: 'user', content: text };
		messages = [...messages, userMsg];

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					botId: respondingBot.id,
					messages: messages.slice(-20).map((m) => {
						if (m.role === 'assistant') {
							const { text: stripped } = parseResponder(m.content);
							return { role: m.role, content: stripped };
						}
						return m;
					}),
					sessionId: getSessionId(),
					timezone: os.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
				})
			});

			if (!response.ok) {
				const err = await response.text();
				console.error(`Chat error (${response.status}):`, err);
				messages = [
					...messages,
					{ role: 'assistant', content: `[${respondingBot.name}] ${randomExcuse()}` }
				];
				busy = false;
				streamingBotName = '';
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
					let chunk: TextChunk;
					try {
						chunk = JSON.parse(line.slice(6));
					} catch {
						continue;
					}
					if (chunk.type === 'text' && chunk.text) {
						streamingText += chunk.text;
					} else if (chunk.type === 'done') {
						messages = [
							...messages,
							{ role: 'assistant', content: `[${respondingBot.name}] ${streamingText}` }
						];
						streamingText = '';
					} else if (chunk.type === 'error') {
						console.error('Stream error:', chunk.error);
						messages = [
							...messages,
							{ role: 'assistant', content: `[${respondingBot.name}] ${randomExcuse()}` }
						];
						streamingText = '';
					}
				}
			}

			if (streamingText) {
				messages = [
					...messages,
					{ role: 'assistant', content: `[${respondingBot.name}] ${streamingText}` }
				];
				streamingText = '';
			}
		} catch (e) {
			console.error('Connection error:', e);
			messages = [
				...messages,
				{ role: 'assistant', content: `[${respondingBot.name}] ${randomExcuse()}` }
			];
		} finally {
			busy = false;
			streamingBotName = '';
			saveConversation(showSlug, {
				botId: showSlug,
				group: showSlug,
				messages,
				updatedAt: Date.now()
			});
		}
	}

	const ALLOWED_TAGS = [
		'p',
		'em',
		'strong',
		'code',
		'pre',
		'ul',
		'ol',
		'li',
		'a',
		'br',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'blockquote',
		'span',
		'del'
	];
	const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

	// marked (CommonMark parser) + dompurify (HTML sanitizer) are heavy and only
	// needed once a bot message renders. Load them lazily so TV-guide-only or
	// game-only visitors never fetch them. Until they resolve, bot text renders as
	// escaped plain text — never raw HTML — so there is no XSS window.
	type Marked = typeof import('marked').marked;
	type DOMPurifyT = typeof import('dompurify').default;
	let marked = $state<Marked | null>(null);
	let DOMPurify = $state<DOMPurifyT | null>(null);

	async function loadMarkdownLibs(): Promise<void> {
		if (marked && DOMPurify) return;
		const [markedMod, purifyMod] = await Promise.all([import('marked'), import('dompurify')]);
		const purify = purifyMod.default;
		// Force all links to open in a new tab with noopener (registered once the
		// sanitizer is actually loaded — same hook, same behavior as before).
		purify.addHook('afterSanitizeAttributes', (node) => {
			if (node.tagName === 'A' && node.hasAttribute('href')) {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
		marked = markedMod.marked;
		DOMPurify = purify;
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function renderMarkdown(text: string): string {
		// Reads the `marked`/`DOMPurify` runes, so the {@html} calling this
		// re-renders once loadMarkdownLibs() sets them. Before they load, show
		// escaped plain text — transient, and XSS-safe regardless.
		if (!marked || !DOMPurify) return escapeHtml(text);
		const raw = marked.parse(text, { async: false }) as string;
		return DOMPurify.sanitize(raw, {
			ALLOWED_TAGS,
			ALLOWED_ATTR,
			ALLOW_DATA_ATTR: false
		});
	}
</script>

{#if group && castBots.length > 0}
	<div class="chat-container">
		<div class="chat-header">
			<div class="chat-avatar">
				{showInitials}
			</div>
			<div class="who">
				<span class="name">{showName.toUpperCase()}</span>
				<small>{castNames}</small>
			</div>
			<div class="chat-header-right">
				{#if minutesLeft !== null}
					<span class="countdown">{formatTimeUntil(minutesLeft)} left</span>
				{/if}
				<Dropdown options={modeOptions} bind:value={chatMode} separatorAfter={['group']} />
			</div>
		</div>

		<div class="chat-log" bind:this={logEl}>
			<div class="bubble system">
				— Switched to {showName}. {castBots.map((b) => b.name.split(' ')[0]).join(', ')} are now in the
				room. —
			</div>
			{#each messages as m, i (i)}
				{#if m.role === 'user'}
					<div class="bubble user">
						<span class="who-label">YOU</span>
						{m.content}
					</div>
				{:else}
					{@const parsed = parseResponder(m.content)}
					<div class="bubble bot">
						<span class="who-label">{parsed.name?.toUpperCase() ?? showName.toUpperCase()}</span>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html renderMarkdown(parsed.text)}
					</div>
				{/if}
			{/each}
			{#if streamingText}
				<div class="bubble bot streaming">
					<span class="who-label">{streamingBotName.toUpperCase()}</span>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html renderMarkdown(streamingText)}
				</div>
			{/if}
			{#if busy && !streamingText}
				<div class="bubble bot typing">
					<span class="who-label">{streamingBotName.toUpperCase()} is typing</span>
					<span class="dot">●</span><span class="dot">●</span><span class="dot">●</span>
				</div>
			{/if}
		</div>

		{#if offAir}
			<div class="off-air-banner">
				{showName.toUpperCase()} has gone off air. Check the TV Guide for what's on now.
			</div>
		{/if}

		<form
			class="chat-input"
			onsubmit={(e) => {
				e.preventDefault();
				send();
			}}
		>
			<input bind:value={input} placeholder={inputPlaceholder} disabled={busy || offAir} />
			<button type="submit" disabled={busy || offAir}
				>{offAir ? 'OFF AIR' : busy ? '...' : 'SEND'}</button
			>
		</form>
	</div>
{:else}
	<div class="window-content">
		<p>This show is no longer available.</p>
	</div>
{/if}

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
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.who {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		line-height: 1.4;
		min-width: 0;
	}
	.who small {
		display: block;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 15px;
		margin-top: 4px;
		opacity: 0.75;
	}
	.chat-header-right {
		margin-left: auto;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}
	.countdown {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
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
		font-family: var(--brand-font-body, 'VT323', monospace);
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
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
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
		border-left: 4px solid var(--accent);
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
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
	}
	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
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
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 19px;
		outline: none;
	}
	.chat-input button {
		border: none;
		border-left: 2px solid var(--ink);
		background: var(--accent);
		color: var(--paper);
		padding: 0 16px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
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
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		letter-spacing: 0.03em;
		line-height: 1.4;
		text-align: center;
		flex-shrink: 0;
	}
</style>
