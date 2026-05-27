<script lang="ts">
	import MiniShelfBox from './MiniShelfBox.svelte';
	import CardboardBox from './CardboardBox.svelte';
	import type { StoreApp } from './store-data';

	let {
		side,
		apps,
		label,
		color,
		gap = 0,
		tilt = 0,
		top = 110,
		width = 184,
		boxW = 52,
		boxH = 76
	}: {
		side: 'left' | 'right';
		apps: StoreApp[];
		label: string;
		color: string;
		gap?: number;
		tilt?: number;
		top?: number;
		width?: number;
		boxW?: number;
		boxH?: number;
	} = $props();

	const isLeft = $derived(side === 'left');
	const top3 = $derived(apps.slice(0, 3));
	const bottom3 = $derived(apps.slice(3, 6));
	const headerFontSize = $derived(Math.max(11, Math.round(boxW * 0.22)));
</script>

<div
	class="shelf"
	class:left={isLeft}
	class:right={!isLeft}
	style:top="{top}px"
	style:width="{width}px"
	style:--gap="{gap}px"
	style:transform={tilt ? `perspective(1600px) rotateY(${tilt}deg)` : undefined}
	style:transform-origin={isLeft ? '0% 50%' : '100% 50%'}
>
	{#if tilt !== 0}
		<div class="side-face" class:side-left={isLeft} class:side-right={!isLeft}>
			<div class="side-tier-line" style:top="33%"></div>
			<div class="side-tier-line" style:top="66%"></div>
			<div class="side-grain"></div>
		</div>
	{/if}

	<div class="cardboard-pile">
		<CardboardBox w={Math.round(boxW * 0.7)} h={20} shade="light" />
		<CardboardBox w={Math.round(boxW * 0.6)} h={28} shade="dark" />
		<CardboardBox w={Math.round(boxW * 0.8)} h={16} shade="light" />
		<CardboardBox w={Math.round(boxW * 0.65)} h={24} shade="dark" />
	</div>

	<div class="header" style:background={color} style:font-size="{headerFontSize}px">
		{label}
	</div>

	<div class="shelf-body">
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
		<div class="plank bottom-plank"></div>
	</div>
</div>

<style>
	.shelf {
		position: absolute;
		display: flex;
		flex-direction: column;
		z-index: 3;
		transform-style: preserve-3d;
	}
	.shelf.left {
		left: var(--gap);
	}
	.shelf.right {
		right: var(--gap);
	}
	.side-face {
		position: absolute;
		top: 30px;
		bottom: 0;
		width: 22px;
		background: linear-gradient(180deg, #7a4f2a 0%, #6a4220 60%, #5a3818 100%);
		border: 2px solid #0a0a0a;
		backface-visibility: hidden;
		z-index: 1;
	}
	.side-face.side-left {
		left: 0;
		transform-origin: 0% 50%;
		transform: rotateY(-90deg);
	}
	.side-face.side-right {
		right: 0;
		transform-origin: 100% 50%;
		transform: rotateY(90deg);
	}
	.side-tier-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: #3a1f10;
	}
	.side-grain {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(0deg, transparent 0 6px, rgba(0, 0, 0, 0.12) 6px 7px);
	}
	.cardboard-pile {
		height: 30px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 5px;
		padding-left: 10px;
		padding-right: 10px;
		flex-shrink: 0;
	}
	.header {
		color: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 7px 8px 6px;
		font-family: 'Press Start 2P', monospace;
		letter-spacing: 0.06em;
		text-align: center;
		flex-shrink: 0;
		position: relative;
		z-index: 2;
	}
	.shelf-body {
		background: #a06a3a;
		border: 2px solid #0a0a0a;
		border-top: none;
		box-shadow: 3px 4px 0 rgba(0, 0, 0, 0.2);
		padding: 14px 6px 0;
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.tier {
		display: flex;
		gap: 6px;
		justify-content: center;
		align-items: flex-end;
	}
	.plank {
		height: 6px;
		background: #7a4f2a;
		border-top: 2px solid #0a0a0a;
		border-bottom: 2px solid #0a0a0a;
		margin: 10px -8px;
		box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18);
	}
	.bottom-plank {
		margin-bottom: 0;
	}
</style>
