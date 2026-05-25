<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		disabled = false,
		alias = false,
		selected = false,
		ondblclick,
		onselect,
		oncontextmenu,
		children
	}: {
		label: string;
		disabled?: boolean;
		alias?: boolean;
		selected?: boolean;
		ondblclick: () => void;
		onselect?: () => void;
		oncontextmenu?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="desktop-icon"
	class:disabled
	class:alias
	class:selected
	onclick={(e) => {
		e.stopPropagation();
		onselect?.();
	}}
	{ondblclick}
	oncontextmenu={(e) => {
		if (oncontextmenu) {
			e.preventDefault();
			e.stopPropagation();
			onselect?.();
			oncontextmenu(e);
		}
	}}
>
	<div class="glyph">
		{@render children()}
	</div>
	<div class="label">{label}</div>
</div>

<style>
	.desktop-icon {
		width: 80px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		cursor: pointer;
		color: var(--paper);
		text-shadow: 1px 1px 0 var(--ink);
	}
	.desktop-icon.disabled {
		opacity: 0.5;
		filter: grayscale(0.6);
	}
	.glyph {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	.desktop-icon.alias .glyph::after {
		content: '\21A9';
		position: absolute;
		bottom: -2px;
		left: -2px;
		font-size: 14px;
		color: var(--paper);
		text-shadow: 1px 1px 0 var(--ink);
		line-height: 1;
	}
	.label {
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 13px;
		text-align: center;
		line-height: 1.15;
		padding: 1px 4px;
		background: transparent;
		font-weight: 500;
	}
	.desktop-icon.selected .label {
		background: var(--ink);
		color: var(--paper);
		text-shadow: none;
	}
	.desktop-icon.selected .glyph {
		outline: 1px dotted var(--paper);
		outline-offset: 2px;
	}
</style>
