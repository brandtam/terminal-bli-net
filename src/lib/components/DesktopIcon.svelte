<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		disabled = false,
		alias = false,
		selected = false,
		draggable = false,
		dropTarget = false,
		ondblclick,
		onselect,
		oncontextmenu,
		ondragstart,
		ondragend,
		ondragover,
		ondragleave,
		ondrop,
		children
	}: {
		label: string;
		disabled?: boolean;
		alias?: boolean;
		selected?: boolean;
		draggable?: boolean;
		dropTarget?: boolean;
		ondblclick: () => void;
		onselect?: () => void;
		oncontextmenu?: (e: MouseEvent) => void;
		ondragstart?: (e: DragEvent) => void;
		ondragend?: (e: DragEvent) => void;
		ondragover?: (e: DragEvent) => void;
		ondragleave?: (e: DragEvent) => void;
		ondrop?: (e: DragEvent) => void;
		children: Snippet;
	} = $props();
</script>

<div
	class="desktop-icon"
	class:disabled
	class:alias
	class:selected
	class:drop-target={dropTarget}
	{draggable}
	role="button"
	tabindex="0"
	onclick={(e) => {
		e.stopPropagation();
		onselect?.();
	}}
	{ondblclick}
	onkeydown={(e) => {
		if (e.key === 'Enter') {
			ondblclick();
		} else if (e.key === ' ') {
			e.preventDefault();
			onselect?.();
		}
	}}
	oncontextmenu={(e) => {
		if (oncontextmenu) {
			e.preventDefault();
			e.stopPropagation();
			onselect?.();
			oncontextmenu(e);
		}
	}}
	{ondragstart}
	{ondragend}
	{ondragover}
	{ondragleave}
	{ondrop}
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
	.desktop-icon[draggable='true'] {
		cursor: grab;
	}
	.desktop-icon[draggable='true']:active {
		cursor: grabbing;
	}
	.desktop-icon.drop-target .glyph {
		background: var(--accent-2, #f9bd2b);
		outline: 2px dashed var(--paper);
		outline-offset: 3px;
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
