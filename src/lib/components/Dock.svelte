<script lang="ts">
	import type { InstalledApp } from '$lib/terminalos';

	let {
		installedApps = [],
		onopen,
		openIds = []
	}: {
		installedApps: InstalledApp[];
		onopen: (id: string) => void;
		openIds: string[];
	} = $props();

	let collapsed = $state(false);
	let pos = $state<{ x: number; y: number } | null>(null);
	let dragRef: { offX: number; offY: number } | null = null;

	const systemItems = [
		{ id: 'welcome', icon: '★', tip: 'Welcome' },
		{ id: 'about', icon: 'i', tip: 'About' },
		{ id: 'trash', icon: 'T', tip: 'Trash' }
	];

	const items = $derived([
		...systemItems,
		...installedApps.map((app) => ({ id: app.windowId, icon: app.icon, tip: app.name }))
	]);

	function onPointerDown(e: PointerEvent) {
		if (
			(e.target as HTMLElement).closest('.dock-item') ||
			(e.target as HTMLElement).closest('.dock-btn')
		)
			return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dragRef = { offX: e.clientX - rect.left, offY: e.clientY - rect.top };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragRef) return;
		pos = { x: e.clientX - dragRef.offX, y: e.clientY - dragRef.offY };
	}

	function onPointerUp(e: PointerEvent) {
		dragRef = null;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* pointer already released */
		}
	}
</script>

<div
	class="dock"
	role="toolbar"
	tabindex="-1"
	class:collapsed
	style={pos ? `left: ${pos.x}px; top: ${pos.y}px; bottom: auto; transform: none;` : ''}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	<div class="dock-handle" title="drag to move">⋮⋮</div>
	{#if !collapsed}
		{#each items as it (it.id)}
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
		background: var(--chrome-dock-bg, var(--paper));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 var(--shadow);
		z-index: 9999;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		align-items: center;
		touch-action: none;
	}
	.dock-handle {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		padding: 0 4px;
		color: var(--ink);
		cursor: grab;
		opacity: 0.55;
		letter-spacing: -2px;
	}
	.dock-handle:active {
		cursor: grabbing;
	}
	.dock-btn {
		appearance: none;
		margin-left: 3px;
		border: 2px solid var(--ink);
		background: var(--paper);
		width: 20px;
		height: 22px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}
	.dock-btn:hover {
		background: var(--accent-2);
	}
	.dock.collapsed {
		padding: 5px 7px;
		gap: 3px;
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
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 14px;
	}
	.tooltip {
		position: absolute;
		bottom: 44px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--chrome-tooltip-bg, var(--ink));
		color: var(--chrome-tooltip-fg, var(--paper));
		font: var(--chrome-tooltip-font, 8px var(--brand-font-display, 'Press Start 2P', monospace));
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
