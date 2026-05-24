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

	const MIN_W = 260;
	const MIN_H = 140;

	let dragState: { startX: number; startY: number; origX: number; origY: number } | null = null;
	let resizeSEState: { startX: number; startY: number; origW: number; origH: number } | null =
		null;
	let resizeNEState: {
		startX: number;
		startY: number;
		origW: number;
		origH: number;
		origX: number;
		origY: number;
	} | null = null;

	function onTitlePointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.window-btn') || (e.target as HTMLElement).closest('.window-growbox-ne')) return;
		onfocus(id);
		dragState = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		document.body.classList.add('dragging');
	}

	function onTitlePointerMove(e: PointerEvent) {
		if (!dragState) return;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const newX = Math.max(40 - width, Math.min(vw - 60, dragState.origX + e.clientX - dragState.startX));
		const newY = Math.max(28, Math.min(vh - 40, dragState.origY + e.clientY - dragState.startY));
		onmove(id, newX, newY);
	}

	function onTitlePointerUp(e: PointerEvent) {
		dragState = null;
		document.body.classList.remove('dragging');
		try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
	}

	function onGrowSEDown(e: PointerEvent) {
		e.stopPropagation();
		onfocus(id);
		resizeSEState = { startX: e.clientX, startY: e.clientY, origW: width, origH: height };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		document.body.classList.add('dragging');
	}

	function onGrowSEMove(e: PointerEvent) {
		if (!resizeSEState) return;
		const newW = Math.max(MIN_W, resizeSEState.origW + e.clientX - resizeSEState.startX);
		const newH = Math.max(MIN_H, resizeSEState.origH + e.clientY - resizeSEState.startY);
		onresize?.(id, newW, newH);
	}

	function onGrowSEUp(e: PointerEvent) {
		resizeSEState = null;
		document.body.classList.remove('dragging');
		try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
	}

	function onGrowNEDown(e: PointerEvent) {
		e.stopPropagation();
		onfocus(id);
		resizeNEState = {
			startX: e.clientX, startY: e.clientY,
			origW: width, origH: height, origX: x, origY: y
		};
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		document.body.classList.add('dragging');
	}

	function onGrowNEMove(e: PointerEvent) {
		if (!resizeNEState) return;
		const dx = e.clientX - resizeNEState.startX;
		const dy = e.clientY - resizeNEState.startY;
		const newW = Math.max(MIN_W, resizeNEState.origW + dx);
		const desiredH = resizeNEState.origH - dy;
		const newH = Math.max(MIN_H, desiredH);
		const effectiveDy = resizeNEState.origH - newH;
		const newY = Math.max(28, resizeNEState.origY + effectiveDy);
		onresize?.(id, newW, newH);
		onmove?.(id, resizeNEState.origX, newY);
	}

	function onGrowNEUp(e: PointerEvent) {
		resizeNEState = null;
		document.body.classList.remove('dragging');
		try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="window {active ? '' : 'inactive'} {className}"
	style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; z-index: {z};"
	onmousedown={() => onfocus(id)}
	role="dialog"
	aria-label={title}
	tabindex="-1"
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
				onclick={(e) => { e.stopPropagation(); onclose(id); }}
				aria-label="close"
			></button>
		</div>
		<div class="title">{title}</div>
		<div class="btns right">
			{#if resizable}
				<div
					class="window-growbox-ne"
					onpointerdown={onGrowNEDown}
					onpointermove={onGrowNEMove}
					onpointerup={onGrowNEUp}
					onpointercancel={onGrowNEUp}
					aria-label="resize"
					title="resize"
				>
					<svg viewBox="0 0 11 11" width="11" height="11" shape-rendering="crispEdges">
						<rect x="10" y="0" width="1" height="1" fill="currentColor"/>
						<rect x="10" y="2" width="1" height="1" fill="currentColor"/>
						<rect x="10" y="4" width="1" height="1" fill="currentColor"/>
						<rect x="10" y="6" width="1" height="1" fill="currentColor"/>
						<rect x="10" y="8" width="1" height="1" fill="currentColor"/>
						<rect x="8" y="0" width="1" height="1" fill="currentColor"/>
						<rect x="8" y="2" width="1" height="1" fill="currentColor"/>
						<rect x="8" y="4" width="1" height="1" fill="currentColor"/>
						<rect x="8" y="6" width="1" height="1" fill="currentColor"/>
						<rect x="6" y="0" width="1" height="1" fill="currentColor"/>
						<rect x="6" y="2" width="1" height="1" fill="currentColor"/>
						<rect x="6" y="4" width="1" height="1" fill="currentColor"/>
						<rect x="4" y="0" width="1" height="1" fill="currentColor"/>
						<rect x="4" y="2" width="1" height="1" fill="currentColor"/>
						<rect x="2" y="0" width="1" height="1" fill="currentColor"/>
					</svg>
				</div>
			{/if}
		</div>
	</div>
	<div class="window-body">
		{@render children()}
	</div>
	{#if resizable}
		<div
			class="window-growbox"
			onpointerdown={onGrowSEDown}
			onpointermove={onGrowSEMove}
			onpointerup={onGrowSEUp}
			onpointercancel={onGrowSEUp}
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
	/* Window chrome — consumes chrome tokens from the active OS theme.
	   Falls back to legacy --ink/--paper vars during migration. */
	.window {
		position: absolute;
		background: var(--chrome-window-bg, var(--paper));
		border: var(--chrome-window-border, 2px solid var(--ink));
		box-shadow: var(--chrome-window-shadow, 4px 4px 0 var(--shadow));
		border-radius: var(--chrome-window-radius, 0);
		display: flex;
		flex-direction: column;
		min-width: 260px;
		min-height: 120px;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		color: var(--brand-color-ink, var(--ink));
	}

	.window-titlebar {
		height: var(--chrome-titlebar-height, 22px);
		border-bottom: 2px solid var(--chrome-window-border-color, var(--ink));
		display: flex;
		align-items: center;
		padding: 0 6px;
		gap: 6px;
		background: var(--chrome-titlebar-bg, repeating-linear-gradient(0deg, var(--ink) 0 1px, var(--paper) 1px 3px));
		cursor: grab;
		position: relative;
		flex-shrink: 0;
	}

	.window.inactive .window-titlebar {
		background: var(--chrome-titlebar-bg-inactive, var(--paper));
	}

	.window-titlebar:active {
		cursor: grabbing;
	}

	.window-titlebar .title {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--chrome-window-bg, var(--paper));
		padding: 0 8px;
		font: var(--chrome-titlebar-font, 600 14px var(--brand-font-ui, 'Pixelify Sans', sans-serif));
		white-space: nowrap;
		line-height: 1;
		color: var(--chrome-titlebar-fg, var(--ink));
	}

	.window-btn {
		width: var(--chrome-wbtn-size, 14px);
		height: var(--chrome-wbtn-size, 14px);
		background: var(--chrome-wbtn-close-bg, var(--paper));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		line-height: 1;
		color: var(--chrome-wbtn-close-fg, var(--ink));
	}

	.window-btn:hover {
		background: var(--chrome-window-border-color, var(--ink));
		color: var(--chrome-window-bg, var(--paper));
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
		background: var(--chrome-window-bg, var(--paper));
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: var(--brand-text-lg, 19px);
		line-height: 1.25;
		position: relative;
	}

	:global(.window-body)::-webkit-scrollbar {
		width: var(--chrome-scroll-width, 14px);
		height: var(--chrome-scroll-width, 14px);
	}
	:global(.window-body)::-webkit-scrollbar-track {
		background: var(--chrome-scroll-track-bg, var(--paper));
		border-left: 2px solid var(--chrome-window-border-color, var(--ink));
	}
	:global(.window-body)::-webkit-scrollbar-thumb {
		background: var(--chrome-scroll-thumb-bg, var(--ink));
		border: 3px solid var(--chrome-scroll-track-bg, var(--paper));
	}

	/* Grow box — bottom-right (SE) */
	.window-growbox {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 18px;
		height: 18px;
		background: var(--chrome-window-bg, var(--paper));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		cursor: nwse-resize;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		color: var(--chrome-window-border-color, var(--ink));
		padding: 1px;
		z-index: 2;
	}

	.window-growbox:hover {
		background: var(--brand-color-yellow, var(--accent-2));
	}

	/* Grow box — top-right (NE), inside titlebar */
	.window-growbox-ne {
		width: 20px;
		height: 20px;
		background: var(--brand-color-yellow, var(--accent-2));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		cursor: nesw-resize;
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		color: var(--chrome-window-border-color, var(--ink));
		padding: 1px;
		margin: -1px -2px -1px 0;
		flex-shrink: 0;
	}

	.window-growbox-ne:hover {
		background: var(--brand-color-orange, var(--accent));
		color: var(--brand-color-paper, var(--paper));
	}

	.window-growbox-ne svg, .window-growbox svg {
		display: block;
	}
</style>
