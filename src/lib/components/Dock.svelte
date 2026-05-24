<script lang="ts">
	let {
		onopen,
		openIds = []
	}: {
		onopen: (id: string) => void;
		openIds: string[];
	} = $props();

	let collapsed = $state(false);

	const items = [
		{ id: 'tv-guide', icon: '▦', tip: 'TV Guide' },
		{ id: 'chat', icon: '✎', tip: 'Chat' },
		{ id: 'pricing', icon: '$', tip: 'Pricing' },
		{ id: 'readme', icon: '?', tip: 'README' },
		{ id: 'about', icon: 'i', tip: 'About' },
		{ id: 'trash', icon: '⌫', tip: 'Trash' }
	];
</script>

<div class="dock" class:collapsed>
	<div class="dock-handle" title="dock">⋮⋮</div>
	{#if !collapsed}
		{#each items as it}
			<button
				class="dock-item"
				class:active={openIds.includes(it.id)}
				onclick={() => onopen(it.id)}
				title={it.tip}
			>
				<span class="dock-icon">{it.icon}</span>
				<span class="tooltip">{it.tip}</span>
			</button>
		{/each}
	{/if}
	<button
		class="dock-btn"
		onclick={(e) => {
			e.stopPropagation();
			collapsed = !collapsed;
		}}
		title={collapsed ? 'expand' : 'collapse'}
	>
		{collapsed ? '▸' : '◂'}
	</button>
</div>

<style>
	.dock {
		position: fixed;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 5px;
		padding: 5px 7px;
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 3px 3px 0 var(--shadow);
		z-index: 9999;
		font-family: 'Pixelify Sans', sans-serif;
		align-items: center;
	}
	.dock-handle {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		padding: 0 4px;
		color: var(--ink);
		opacity: 0.55;
		letter-spacing: -2px;
	}
	.dock-btn {
		appearance: none;
		margin-left: 3px;
		border: 2px solid var(--ink);
		background: var(--paper);
		width: 20px;
		height: 22px;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}
	.dock-btn:hover {
		background: var(--accent-2);
	}
	.dock-item {
		width: 32px;
		height: 32px;
		border: 2px solid var(--ink);
		background: var(--paper-soft);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		font-size: 16px;
		padding: 0;
	}
	.dock-item:hover {
		background: var(--accent-2);
	}
	.dock-item.active::after {
		content: '';
		position: absolute;
		bottom: -8px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		background: var(--paper);
		border: 1px solid var(--ink);
	}
	.dock-icon {
		font-family: 'Press Start 2P', monospace;
		font-size: 14px;
	}
	.tooltip {
		position: absolute;
		bottom: 44px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--ink);
		color: var(--paper);
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		padding: 4px 6px;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.1s;
	}
	.dock-item:hover .tooltip {
		opacity: 1;
	}
</style>
