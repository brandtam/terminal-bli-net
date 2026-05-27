<script lang="ts">
	import PixelIcon from './PixelIcon.svelte';
	import type { StoreApp } from './store-data';
	import { CAT_COLORS } from './store-data';

	let { app, w = 52, h = 72 }: { app: StoreApp; w?: number; h?: number } = $props();

	const cat = $derived(CAT_COLORS[app.cat] || CAT_COLORS.PROD);
	const iconSize = $derived(Math.min(Math.floor(h * 0.5), w - 14));
	const bandH = $derived(Math.max(10, Math.floor(h * 0.18)));
	const bottomH = $derived(Math.max(6, Math.floor(h * 0.11)));

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

<div class="mini-box" style:width="{w}px" style:height="{h}px">
	<div class="band" style:height="{bandH}px" style:background={cat.band}>
		<div class="band-shine"></div>
	</div>
	<div class="splash" style:background={cat.splash}>
		<PixelIcon name={app.icon} size={iconSize} />
	</div>
	<div class="trim" style:height="{bottomH}px" style:background={cat.trim}></div>
	{#if stickerCfg}
		<div
			class="sticker"
			style:background={stickerCfg.bg}
			style:color={stickerCfg.fg}
			style:font-size="{Math.max(4, Math.round(w * 0.13))}px"
			style:padding="{Math.max(1, Math.round(w * 0.03))}px {Math.max(1, Math.round(w * 0.06))}px"
			style:top="-{Math.max(2, Math.round(w * 0.1))}px"
			style:right="-{Math.max(2, Math.round(w * 0.1))}px"
		>
			{stickerCfg.label}
		</div>
	{/if}
</div>

<style>
	.mini-box {
		background: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 1px 2px 0 rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		font-family: 'Pixelify Sans', sans-serif;
		position: relative;
	}
	.band {
		border-bottom: 1px solid #0a0a0a;
		position: relative;
	}
	.band-shine {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: rgba(255, 255, 255, 0.45);
	}
	.splash {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 3px;
		position: relative;
	}
	.sticker {
		position: absolute;
		transform: rotate(-10deg);
		border: 1px solid #0a0a0a;
		box-shadow: 1px 1px 0 #0a0a0a;
		font-family: 'Press Start 2P', monospace;
		letter-spacing: 0.04em;
		white-space: nowrap;
		z-index: 5;
	}
</style>
