<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		disabled = false,
		ondblclick,
		children
	}: {
		label: string;
		disabled?: boolean;
		ondblclick: () => void;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="desktop-icon"
	class:disabled
	ondblclick={ondblclick}
	onclick={ondblclick}
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
	.desktop-icon:hover .label,
	.desktop-icon:focus .label {
		background: var(--ink);
		color: var(--paper);
		text-shadow: none;
	}
</style>
