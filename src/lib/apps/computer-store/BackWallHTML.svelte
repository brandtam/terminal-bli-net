<script lang="ts">
	import MiniShelfBox from './MiniShelfBox.svelte';
	import type { StoreApp } from './store-data';

	let {
		apps,
		label,
		color,
		left = 220,
		top = 114,
		width = 108,
		boxW = 24,
		boxH = 30,
		tilt = 0
	}: {
		apps: StoreApp[];
		label: string;
		color: string;
		left?: number;
		top?: number;
		width?: number;
		boxW?: number;
		boxH?: number;
		tilt?: number;
	} = $props();

	const top3 = $derived(apps.slice(0, 3));
	const bottom3 = $derived(apps.slice(3, 6));
	const headerFontSize = $derived(Math.max(6, Math.round(boxW * 0.3)));
</script>

<div
	class="back-wall"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{width}px"
	style:transform={tilt ? `perspective(1400px) rotateY(${tilt}deg)` : undefined}
>
	<div class="header" style:background={color} style:font-size="{headerFontSize}px">
		{label}
	</div>
	<div class="body">
		<div class="tier">
			{#each top3 as app, i (i)}
				<MiniShelfBox {app} w={boxW} h={boxH} />
			{/each}
		</div>
		<div class="plank"></div>
		<div class="tier">
			{#each bottom3 as app, i (i)}
				<MiniShelfBox {app} w={boxW} h={boxH} />
			{/each}
		</div>
		<div class="plank bottom"></div>
	</div>
</div>

<style>
	.back-wall {
		position: absolute;
		display: flex;
		flex-direction: column;
		z-index: 2;
		transform-origin: 50% 50%;
	}
	.header {
		color: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 3px 4px;
		font-family: 'Press Start 2P', monospace;
		letter-spacing: 0.04em;
		text-align: center;
		white-space: nowrap;
		flex-shrink: 0;
		z-index: 2;
	}
	.body {
		background: #a06a3a;
		border: 2px solid #0a0a0a;
		border-top: none;
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.2);
		padding: 4px 4px 0;
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.tier {
		display: flex;
		gap: 2px;
		justify-content: center;
		align-items: flex-end;
	}
	.plank {
		height: 3px;
		background: #7a4f2a;
		border-top: 1px solid #0a0a0a;
		border-bottom: 1px solid #0a0a0a;
		margin: 3px -6px;
	}
	.plank.bottom {
		margin-bottom: 0;
	}
</style>
