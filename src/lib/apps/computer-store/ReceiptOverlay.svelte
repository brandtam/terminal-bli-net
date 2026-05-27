<script lang="ts">
	import { APP_BY_ID } from './store-data';

	let {
		items,
		onclose,
		onleave
	}: {
		items: string[];
		onclose: () => void;
		onleave: () => void;
	} = $props();

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scrim" onclick={onclose}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="receipt" onclick={(e) => e.stopPropagation()}>
		<div class="receipt-header">★ THANK YOU ★</div>

		<div class="receipt-body">
			<div class="shop-name">
				SOFTWARE SHOP
				<div class="separator">─── ─── ─── ─── ───</div>
			</div>

			{#each items as id (id)}
				<div class="line-item">
					<span>{APP_BY_ID[id]?.title ?? id}</span>
					<span>$0.00</span>
				</div>
			{/each}

			<div class="total-row">
				<span>TOTAL</span>
				<span>$0.00</span>
			</div>

			<div class="footer-text">
				{items.length} item{items.length === 1 ? '' : 's'} on your shelf now.<br />
				looks like you're developing quite a little software library.<br />
				have fun.
			</div>
		</div>

		<div class="btn-row">
			<button class="btn" onclick={onclose}>◂ KEEP BROWSING</button>
			<button class="btn primary" onclick={onleave}>▸ LEAVE THE STORE</button>
		</div>
	</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.receipt {
		width: 280px;
		background: #fffceb;
		border: 2px solid #0a0a0a;
		box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.55);
		font-family: 'VT323', monospace;
		font-size: 16px;
		background-image: repeating-linear-gradient(
			0deg,
			transparent 0 22px,
			rgba(0, 0, 0, 0.05) 22px 23px
		);
	}

	.receipt-header {
		background: #0a0a0a;
		color: #f9bd2b;
		padding: 8px 12px;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		letter-spacing: 0.04em;
		text-align: center;
	}

	.receipt-body {
		padding: 16px 18px;
		line-height: 1.4;
	}

	.shop-name {
		text-align: center;
		margin-bottom: 8px;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
	}

	.separator {
		font-family: 'VT323', monospace;
		font-size: 13px;
		margin-top: 4px;
		opacity: 0.7;
	}

	.line-item {
		display: flex;
		justify-content: space-between;
	}

	.total-row {
		border-top: 2px solid #0a0a0a;
		margin: 8px 0;
		padding-top: 6px;
		display: flex;
		justify-content: space-between;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
	}

	.footer-text {
		text-align: center;
		margin-top: 10px;
		opacity: 0.75;
	}

	.btn-row {
		display: flex;
		gap: 8px;
		padding: 12px 18px;
		border-top: 2px solid var(--ink, #0a0a0a);
	}
	.btn-row :global(.btn) {
		flex: 1;
		text-align: center;
		font-size: 9px;
		font-family: 'Press Start 2P', monospace;
		padding: 10px 8px;
	}
</style>
