<script lang="ts">
	let {
		id,
		left,
		top,
		width,
		height,
		label,
		sublabel = '',
		hot,
		onenter,
		onleave,
		onclick
	}: {
		id: string;
		left: string;
		top: string;
		width: string;
		height: string;
		label: string;
		sublabel?: string;
		hot: string | null;
		onenter: () => void;
		onleave: () => void;
		onclick: () => void;
	} = $props();

	const isHot = $derived(hot === id);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="hotspot"
	class:active={isHot}
	style:left
	style:top
	style:width
	style:height
	onmouseenter={onenter}
	onmouseleave={onleave}
	{onclick}
>
	{#if isHot}
		<div class="tooltip">
			<span class="tooltip-label">▸ {label}</span>
			{#if sublabel}
				<div class="tooltip-sub">{sublabel}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hotspot {
		position: absolute;
		cursor: pointer;
		outline: none;
		background: transparent;
		z-index: 5;
	}
	.hotspot.active {
		outline: 3px dashed #f9bd2b;
		outline-offset: -2px;
		background: rgba(249, 189, 43, 0.1);
	}
	.tooltip {
		position: absolute;
		left: 50%;
		top: -2px;
		transform: translate(-50%, -100%);
		background: #0a0a0a;
		color: #f9bd2b;
		border: 2px solid #f9bd2b;
		box-shadow: 3px 3px 0 #0a0a0a;
		padding: 5px 9px;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 0.04em;
		white-space: nowrap;
		z-index: 6;
	}
	.tooltip-sub {
		font-family: 'VT323', monospace;
		font-size: 13px;
		color: #ffffff;
		margin-top: 2px;
		letter-spacing: 0;
	}
</style>
