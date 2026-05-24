<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		x = $bindable(0),
		y = $bindable(0),
		width = $bindable(380),
		height = $bindable(320),
		z = 1,
		active = false,
		resizable = true,
		className = '',
		onfocus,
		onclose,
		onmove,
		onresize,
		children
	}: {
		id: string;
		title: string;
		x: number;
		y: number;
		width: number;
		height: number;
		z: number;
		active?: boolean;
		resizable?: boolean;
		className?: string;
		onfocus: (id: string) => void;
		onclose: (id: string) => void;
		onmove: (id: string, x: number, y: number) => void;
		onresize?: (id: string, w: number, h: number) => void;
		children: Snippet;
	} = $props();

	let dragState: { startX: number; startY: number; origX: number; origY: number } | null = null;
	let resizeState: { startX: number; startY: number; origW: number; origH: number } | null = null;

	function onTitlePointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.window-btn')) return;
		onfocus(id);
		dragState = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		document.body.classList.add('dragging');
	}

	function onTitlePointerMove(e: PointerEvent) {
		if (!dragState) return;
		const dx = e.clientX - dragState.startX;
		const dy = e.clientY - dragState.startY;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const newX = Math.max(40 - width, Math.min(vw - 60, dragState.origX + dx));
		const newY = Math.max(28, Math.min(vh - 40, dragState.origY + dy));
		onmove(id, newX, newY);
	}

	function onTitlePointerUp(e: PointerEvent) {
		dragState = null;
		document.body.classList.remove('dragging');
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {}
	}

	function onGrowPointerDown(e: PointerEvent) {
		e.stopPropagation();
		onfocus(id);
		resizeState = { startX: e.clientX, startY: e.clientY, origW: width, origH: height };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		document.body.classList.add('dragging');
	}

	function onGrowPointerMove(e: PointerEvent) {
		if (!resizeState) return;
		const dx = e.clientX - resizeState.startX;
		const dy = e.clientY - resizeState.startY;
		const newW = Math.max(260, resizeState.origW + dx);
		const newH = Math.max(140, resizeState.origH + dy);
		onresize?.(id, newW, newH);
	}

	function onGrowPointerUp(e: PointerEvent) {
		resizeState = null;
		document.body.classList.remove('dragging');
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="window {active ? '' : 'inactive'} {className}"
	style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; z-index: {z};"
	onmousedown={() => onfocus(id)}
>
	<div
		class="window-titlebar"
		onpointerdown={onTitlePointerDown}
		onpointermove={onTitlePointerMove}
		onpointerup={onTitlePointerUp}
		onpointercancel={onTitlePointerUp}
	>
		<div class="btns">
			<button
				class="window-btn close"
				onclick={(e) => {
					e.stopPropagation();
					onclose(id);
				}}
				aria-label="close"
			></button>
		</div>
		<div class="title">{title}</div>
		<div class="btns right"></div>
	</div>
	<div class="window-body">
		{@render children()}
	</div>
	{#if resizable}
		<div
			class="window-growbox"
			onpointerdown={onGrowPointerDown}
			onpointermove={onGrowPointerMove}
			onpointerup={onGrowPointerUp}
			onpointercancel={onGrowPointerUp}
			aria-label="resize"
		>
			<svg viewBox="0 0 11 11" width="11" height="11" shape-rendering="crispEdges">
				<rect x="0" y="8" width="1" height="1" fill="currentColor" />
				<rect x="2" y="8" width="1" height="1" fill="currentColor" />
				<rect x="4" y="8" width="1" height="1" fill="currentColor" />
				<rect x="6" y="8" width="1" height="1" fill="currentColor" />
				<rect x="8" y="8" width="1" height="1" fill="currentColor" />
				<rect x="2" y="6" width="1" height="1" fill="currentColor" />
				<rect x="4" y="6" width="1" height="1" fill="currentColor" />
				<rect x="6" y="6" width="1" height="1" fill="currentColor" />
				<rect x="8" y="6" width="1" height="1" fill="currentColor" />
				<rect x="4" y="4" width="1" height="1" fill="currentColor" />
				<rect x="6" y="4" width="1" height="1" fill="currentColor" />
				<rect x="8" y="4" width="1" height="1" fill="currentColor" />
				<rect x="6" y="2" width="1" height="1" fill="currentColor" />
				<rect x="8" y="2" width="1" height="1" fill="currentColor" />
				<rect x="8" y="0" width="1" height="1" fill="currentColor" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.window {
		position: absolute;
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 4px 4px 0 var(--shadow);
		display: flex;
		flex-direction: column;
		min-width: 260px;
		min-height: 120px;
		font-family: 'Pixelify Sans', sans-serif;
		color: var(--ink);
	}
	.window-titlebar {
		height: 22px;
		border-bottom: 2px solid var(--ink);
		display: flex;
		align-items: center;
		padding: 0 6px;
		gap: 6px;
		background: repeating-linear-gradient(0deg, var(--ink) 0 1px, var(--paper) 1px 3px);
		cursor: grab;
		position: relative;
		flex-shrink: 0;
	}
	.window.inactive .window-titlebar {
		background: var(--paper);
	}
	.window-titlebar:active {
		cursor: grabbing;
	}
	.window-titlebar .title {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--paper);
		padding: 0 8px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 14px;
		white-space: nowrap;
		font-weight: 600;
		line-height: 1;
	}
	.window-btn {
		width: 14px;
		height: 14px;
		background: var(--paper);
		border: 2px solid var(--ink);
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		line-height: 1;
	}
	.window-btn:hover {
		background: var(--ink);
		color: var(--paper);
	}
	.window-btn.close::before {
		content: '\00D7';
		font-size: 14px;
	}
	.btns {
		display: flex;
		gap: 4px;
		z-index: 1;
	}
	.btns.right {
		margin-left: auto;
	}
	:global(.window-body) {
		flex: 1;
		overflow: auto;
		background: var(--paper);
		font-family: 'VT323', monospace;
		font-size: 19px;
		line-height: 1.25;
		position: relative;
	}
	.window-growbox {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 18px;
		height: 18px;
		background: var(--paper);
		border: 2px solid var(--ink);
		cursor: nwse-resize;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		color: var(--ink);
		padding: 1px;
		z-index: 2;
	}
	.window-growbox:hover {
		background: var(--accent-2);
	}
</style>
