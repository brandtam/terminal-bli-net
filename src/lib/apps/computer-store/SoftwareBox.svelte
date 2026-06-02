<script lang="ts">
	import PixelIcon from './PixelIcon.svelte';
	import type { StoreApp } from './store-data';
	import { CAT_COLORS } from './store-data';

	let {
		app,
		width = 132,
		height = 178,
		onclick,
		hoverable = true,
		status,
		comingSoon = false,
		lift = false
	}: {
		app: StoreApp;
		width?: number;
		height?: number;
		onclick?: () => void;
		hoverable?: boolean;
		status?: 'installed' | 'in-cart';
		comingSoon?: boolean;
		lift?: boolean;
	} = $props();

	let hovered = $state(false);

	$effect(() => {
		if (!hoverable || !onclick) hovered = false;
	});

	const cat = $derived(CAT_COLORS[app.cat] || CAT_COLORS.PROD);
	const shadow = $derived(
		lift ? '5px 6px 0 #0a0a0a' : hovered ? '4px 5px 0 #0a0a0a' : '3px 4px 0 #0a0a0a'
	);
	const transform = $derived(
		lift ? 'translate(-2px, -3px)' : hovered ? 'translate(-1px, -2px)' : 'none'
	);

	const stickerCfg = $derived.by(() => {
		if (!app.sticker) return null;
		const map: Record<string, { bg: string; fg: string; label: string }> = {
			STAFF_PICK: { bg: '#f54e00', fg: '#ffffff', label: '★ STAFF' },
			SALE: { bg: '#c92127', fg: '#ffffff', label: 'SALE!' },
			NEW: { bg: '#f9bd2b', fg: '#0a0a0a', label: '★ NEW' }
		};
		return map[app.sticker] ?? null;
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="software-box"
	data-testid={`store-box-${app.id}`}
	style:width="{width}px"
	style:height="{height}px"
	style:box-shadow={shadow}
	style:transform
	style:opacity={comingSoon ? 0.72 : 1}
	style:cursor={onclick ? 'pointer' : 'default'}
	{onclick}
	onmouseenter={() => {
		if (hoverable && onclick) hovered = true;
	}}
	onmouseleave={() => {
		hovered = false;
	}}
>
	<div class="band-top" style:background={cat.band}>
		<span class="pub">{app.pub}</span>
		<span class="cat-label">{app.cat}</span>
	</div>

	<div class="hero" style:background={cat.splash}>
		<div class="shine"></div>
		<PixelIcon name={app.icon} size={Math.min(64, width - 28)} />
		<div class="title" class:title-sm={width <= 110}>{app.title}</div>
		<div class="tagline">{app.tagline}</div>
	</div>

	<div class="band-bottom" style:background={cat.trim}>
		<span class="format">3.5" DISK</span>
		<span class="version">v1.0</span>
	</div>

	{#if status === 'installed'}
		<div class="status-sticker owned">OWNED</div>
	{/if}
	{#if status === 'in-cart'}
		<div class="status-sticker in-cart">IN CART</div>
	{/if}
	{#if comingSoon}
		<div class="status-sticker coming-soon">COMING SOON</div>
	{/if}
	{#if stickerCfg}
		<div
			class="promo-sticker"
			style:background={stickerCfg.bg}
			style:color={stickerCfg.fg}
			style:font-size="{Math.max(5, Math.round(width * 0.105))}px"
			style:padding="{Math.max(1, Math.round(width * 0.04))}px {Math.max(
				2,
				Math.round(width * 0.075)
			)}px"
			style:top="-{Math.max(3, Math.round(width * 0.12))}px"
			style:left="-{Math.max(3, Math.round(width * 0.12))}px"
		>
			{stickerCfg.label}
		</div>
	{/if}
</div>

<style>
	.software-box {
		background: #ffffff;
		border: 2px solid #0a0a0a;
		display: flex;
		flex-direction: column;
		position: relative;
		transition:
			transform 0.05s linear,
			box-shadow 0.05s linear;
		flex-shrink: 0;
		font-family: 'Pixelify Sans', sans-serif;
	}
	.band-top {
		height: 22px;
		color: #ffffff;
		border-bottom: 2px solid #0a0a0a;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 5px;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
		letter-spacing: 0.04em;
	}
	.cat-label {
		color: #f9bd2b;
	}
	.hero {
		flex: 1;
		border-bottom: 2px solid #0a0a0a;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4px;
		overflow: hidden;
	}
	.shine {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 8px;
		background: rgba(255, 255, 255, 0.5);
	}
	.title {
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		color: #0a0a0a;
		margin-top: 6px;
		text-align: center;
		line-height: 1.1;
		text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.8);
	}
	.title-sm {
		font-size: 9px;
	}
	.tagline {
		font-family: 'VT323', monospace;
		font-size: 13px;
		color: rgba(10, 10, 10, 0.7);
		margin-top: 2px;
		text-align: center;
		line-height: 1.05;
		padding: 0 2px;
	}
	.band-bottom {
		height: 18px;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 6px;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
	}
	.status-sticker {
		position: absolute;
		top: 26px;
		right: -8px;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 3px 6px;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
		letter-spacing: 0.05em;
		transform: rotate(8deg);
	}
	.status-sticker.owned {
		background: #a6f000;
		color: #0a0a0a;
	}
	.status-sticker.in-cart {
		background: #f9bd2b;
		color: #0a0a0a;
	}
	.status-sticker.coming-soon {
		background: #4a4a8a;
		color: #ffffff;
	}
	.promo-sticker {
		position: absolute;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		font-family: 'Press Start 2P', monospace;
		letter-spacing: 0.04em;
		transform: rotate(-8deg);
		z-index: 5;
		white-space: nowrap;
	}
</style>
