<script lang="ts">
	let {
		visible = false,
		x = 0,
		y = 0,
		canAlias = false,
		canTrash = false,
		onopen,
		onalias,
		ontrash,
		onclose
	}: {
		visible: boolean;
		x: number;
		y: number;
		canAlias: boolean;
		canTrash: boolean;
		onopen?: () => void;
		onalias?: () => void;
		ontrash?: () => void;
		onclose?: () => void;
	} = $props();

	/** Clamp the menu inside the viewport after it's mounted or repositioned. */
	function clampToViewport(el: HTMLElement, pos: { x: number; y: number }) {
		function adjust(px: number, py: number) {
			el.style.left = `${px}px`;
			el.style.top = `${py}px`;
			requestAnimationFrame(() => {
				const rect = el.getBoundingClientRect();
				if (rect.right > window.innerWidth) el.style.left = `${px - rect.width}px`;
				if (rect.bottom > window.innerHeight) el.style.top = `${py - rect.height}px`;
			});
		}
		adjust(pos.x, pos.y);
		return {
			update(newPos: { x: number; y: number }) {
				adjust(newPos.x, newPos.y);
			}
		};
	}
</script>

{#if visible}
	<div
		class="desktop-context-menu"
		role="menu"
		tabindex="-1"
		use:clampToViewport={{ x, y }}
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => {
			if (e.key === 'Escape') onclose?.();
		}}
	>
		<button
			class="desktop-context-item"
			onclick={() => {
				onopen?.();
			}}>Open</button
		>
		{#if canAlias}
			<div class="desktop-context-sep"></div>
			<button
				class="desktop-context-item"
				onclick={() => {
					onalias?.();
				}}>Make Alias</button
			>
		{/if}
		{#if canTrash}
			<div class="desktop-context-sep"></div>
			<button
				class="desktop-context-item"
				onclick={() => {
					ontrash?.();
				}}>Move to Trash</button
			>
		{/if}
	</div>
{/if}

<style>
	.desktop-context-menu {
		position: fixed;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 var(--shadow);
		min-width: 160px;
		padding: 4px 0;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 14px;
		z-index: 12000;
	}
	.desktop-context-item {
		padding: 4px 12px;
		cursor: pointer;
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
	}
	.desktop-context-item:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.desktop-context-sep {
		height: 1px;
		background: var(--chrome-menubar-fg, var(--ink));
		margin: 4px 8px;
		opacity: 0.2;
	}
</style>
