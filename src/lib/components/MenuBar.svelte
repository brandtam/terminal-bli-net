<script lang="ts">
	import { onMount } from 'svelte';

	let {
		onopen,
		openWindows = 0,
		isRecording = false
	}: {
		onopen: (id: string, castId?: string) => void;
		openWindows?: number;
		isRecording?: boolean;
	} = $props();

	let clock = $state('');
	let openMenu = $state<string | null>(null);

	function formatClock(d: Date): string {
		let h = d.getHours();
		const m = String(d.getMinutes()).padStart(2, '0');
		const ampm = h >= 12 ? 'PM' : 'AM';
		h = ((h + 11) % 12) + 1;
		const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
		return `${day} ${h}:${m} ${ampm}`;
	}

	onMount(() => {
		clock = formatClock(new Date());
		const t = setInterval(() => {
			clock = formatClock(new Date());
		}, 1000);
		return () => clearInterval(t);
	});

	interface MenuItem {
		label: string;
		shortcut?: string;
		disabled?: boolean;
		action?: () => void;
	}

	const menus: Record<string, MenuItem[]> = {
		File: [
			{ label: 'TV Guide', shortcut: '⌘G', action: () => onopen('tv-guide') },
			{ label: 'New Chat...', shortcut: '⌘N', action: () => onopen('tv-guide') },
			{ label: 'Print conversation', shortcut: '⌘P', disabled: true },
			{ label: 'Quit (good luck)', shortcut: '⌘Q', disabled: true }
		],
		View: [
			{ label: 'Show Pricing', action: () => onopen('pricing') },
			{ label: 'Show README.txt', action: () => onopen('readme') },
			{ label: 'About this Mac', action: () => onopen('about') },
			{ label: 'Hide everything', disabled: true }
		],
		Cast: [],
		Special: [
			{ label: 'Empty Trash', disabled: true },
			{ label: 'Restart', action: () => onopen('error') },
			{ label: 'Shut Down (don’t)', action: () => onopen('error') }
		]
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menubar" onmouseleave={() => (openMenu = null)}>
	<span class="apple">&bull;</span>
	<span class="menu-item brand">chatrbot.ai</span>
	{#each Object.keys(menus) as m}
		<div class="menu-wrapper" onmouseenter={() => (openMenu = m)}>
			<span class="menu-item" class:open={openMenu === m}>{m}</span>
			{#if openMenu === m}
				<div class="dropdown">
					{#each menus[m] as it}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="dropdown-item"
							class:disabled={it.disabled}
							onclick={() => {
								if (!it.disabled && it.action) {
									openMenu = null;
									it.action();
								}
							}}
						>
							<span>{it.label}</span>
							{#if it.shortcut}
								<span class="shortcut">{it.shortcut}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
	<div class="right">
		<span class="muted info">{openWindows} window{openWindows === 1 ? '' : 's'}</span>
		{#if isRecording}
			<span class="rec"><span class="rec-dot"></span>REC</span>
		{/if}
		<span class="clock">{clock}</span>
	</div>
</div>

<style>
	.menubar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 28px;
		background: var(--paper);
		border-bottom: 2px solid var(--ink);
		display: flex;
		align-items: center;
		padding: 0 12px;
		gap: 18px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 16px;
		z-index: 10000;
		letter-spacing: 0.02em;
	}
	.apple {
		font-size: 18px;
		line-height: 1;
	}
	.menu-item {
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 2px;
	}
	.menu-item:hover,
	.menu-item.open {
		background: var(--ink);
		color: var(--paper);
	}
	.brand {
		font-weight: 600;
	}
	.menu-wrapper {
		position: relative;
	}
	.dropdown {
		position: absolute;
		top: 22px;
		left: 0;
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 3px 3px 0 var(--shadow);
		min-width: 200px;
		padding: 4px 0;
		font-size: 14px;
		z-index: 11000;
	}
	.dropdown-item {
		padding: 4px 12px;
		display: flex;
		justify-content: space-between;
		gap: 24px;
		cursor: pointer;
	}
	.dropdown-item.disabled {
		opacity: 0.4;
		cursor: default;
	}
	.dropdown-item:not(.disabled):hover {
		background: var(--ink);
		color: var(--paper);
	}
	.shortcut {
		opacity: 0.7;
		font-family: 'VT323', monospace;
	}
	.right {
		margin-left: auto;
		display: flex;
		gap: 14px;
		align-items: center;
		font-size: 14px;
	}
	.info {
		font-family: 'VT323', monospace;
	}
	.clock {
		font-family: 'VT323', monospace;
		cursor: pointer;
	}
	.rec {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.rec-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		background: var(--accent);
		animation: blink 1s steps(2, end) infinite;
	}
</style>
