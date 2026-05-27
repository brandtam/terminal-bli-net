<script lang="ts">
	let {
		view,
		breadcrumb,
		onback,
		cartCount,
		oncart
	}: {
		view: string;
		breadcrumb: string;
		onback: (() => void) | null;
		cartCount: number;
		oncart: () => void;
	} = $props();
</script>

<div class="topbar">
	<div class="left">
		{#if onback}
			<button class="back-btn" onclick={onback}>◂ BACK</button>
		{:else}
			<span class="title">★ SOFTWARE SHOP ★</span>
		{/if}
	</div>
	<span class="breadcrumb">{breadcrumb}</span>
	<button class="cart-btn" class:has-items={cartCount > 0} onclick={oncart}>
		CART · {cartCount}
	</button>
</div>

<style>
	.topbar {
		height: 36px;
		background: #0a0a0a;
		color: #ffffff;
		border-bottom: 2px solid #0a0a0a;
		display: flex;
		align-items: center;
		padding: 0 10px;
		gap: 10px;
		flex-shrink: 0;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 0.04em;
	}
	.left {
		flex-shrink: 0;
	}
	.title {
		color: #f9bd2b;
	}
	.back-btn {
		background: #ffffff;
		color: #0a0a0a;
		border: 2px solid #ffffff;
		box-shadow: 2px 2px 0 #f9bd2b;
		padding: 4px 8px;
		cursor: pointer;
		font-family: inherit;
		font-size: 9px;
		letter-spacing: 0.04em;
	}
	.breadcrumb {
		color: rgba(255, 255, 255, 0.5);
	}
	.cart-btn {
		margin-left: auto;
		background: transparent;
		color: #ffffff;
		border: 2px solid #ffffff;
		padding: 4px 8px;
		cursor: default;
		font-family: inherit;
		font-size: 9px;
		letter-spacing: 0.04em;
		box-shadow: none;
	}
	.cart-btn.has-items {
		background: #f54e00;
		cursor: pointer;
		box-shadow: 2px 2px 0 #f9bd2b;
	}
</style>
