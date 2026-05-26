<script lang="ts">
	import { onMount } from 'svelte';

	interface Option {
		value: string;
		label: string;
	}

	let {
		options,
		value = $bindable(),
		separatorAfter = []
	}: {
		options: Option[];
		value: string;
		separatorAfter?: string[];
	} = $props();

	let open = $state(false);
	let wrapEl: HTMLDivElement | undefined = $state();

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? value);

	onMount(() => {
		const close = (e: MouseEvent) => {
			if (open && wrapEl && !wrapEl.contains(e.target as HTMLElement)) {
				open = false;
			}
		};
		document.addEventListener('mousedown', close);
		return () => document.removeEventListener('mousedown', close);
	});
</script>

<div class="dropdown-wrap" bind:this={wrapEl}>
	<button class="dropdown-trigger" class:open onclick={() => (open = !open)}>
		{selectedLabel} ▾
	</button>
	{#if open}
		<div class="dropdown-menu">
			{#each options as opt}
				<button
					class="dropdown-item"
					class:selected={value === opt.value}
					onclick={() => {
						value = opt.value;
						open = false;
					}}
				>
					<span class="dropdown-check">{value === opt.value ? '✓' : ''}</span>
					<span>{opt.label}</span>
				</button>
				{#if separatorAfter.includes(opt.value)}
					<div class="dropdown-sep"></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown-wrap {
		position: relative;
	}
	.dropdown-trigger {
		font: var(--chrome-menubar-font, 16px var(--brand-font-ui, 'Pixelify Sans', sans-serif));
		background: var(--chrome-menubar-bg, var(--paper));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 2px 2px 0 var(--chrome-window-border-color, var(--ink));
		padding: 4px 10px;
		cursor: pointer;
		color: var(--chrome-menubar-fg, var(--ink));
		white-space: nowrap;
		letter-spacing: 0.02em;
	}
	.dropdown-trigger:hover,
	.dropdown-trigger.open {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.dropdown-trigger:active {
		box-shadow: 0 0 0 var(--chrome-window-border-color, var(--ink));
		transform: translate(2px, 2px);
	}
	.dropdown-menu {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35);
		min-width: 180px;
		padding: 4px 0;
		z-index: 100;
		font: var(--chrome-menubar-font, 16px var(--brand-font-ui, 'Pixelify Sans', sans-serif));
	}
	.dropdown-item {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 5px 10px;
		cursor: pointer;
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
	}
	.dropdown-item:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}
	.dropdown-check {
		display: inline-block;
		width: 14px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
	}
	.dropdown-sep {
		height: 1px;
		background: var(--chrome-menubar-fg, var(--ink));
		margin: 4px 8px;
		opacity: 0.2;
	}
</style>
