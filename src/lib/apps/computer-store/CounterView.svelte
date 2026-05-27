<script lang="ts">
	import SoftwareBox from './SoftwareBox.svelte';
	import { APP_BY_ID } from './store-data';

	let {
		cart,
		onremove,
		onringup
	}: {
		cart: string[];
		onremove: (id: string) => void;
		onringup: () => void;
	} = $props();
</script>

<div class="counter-view">
	<!-- Wall -->
	<div class="wall"></div>
	<!-- Floor -->
	<div class="floor"></div>
	<!-- Floor-wall seam -->
	<div class="seam"></div>

	<!-- CHECKOUT sign overhead -->
	<div class="sign-area">
		<div class="sign-holder">
			<div class="sign-cord sign-cord-left"></div>
			<div class="sign-cord sign-cord-right"></div>
			<div class="checkout-sign">
				&#x2605; CHECKOUT &#x2605;
				<div class="sign-sub">
					now serving &middot; <span class="sign-you">&#x25CF; YOU</span>
				</div>
			</div>
		</div>
	</div>

	<!-- RECEIPT panel -->
	<div class="receipt">
		<div class="receipt-header">RECEIPT</div>
		<div class="receipt-body">
			{#if cart.length === 0}
				<div class="receipt-empty">no items yet.</div>
			{:else}
				{#each cart as id (id)}
					<div class="receipt-line">
						<span class="receipt-title">{APP_BY_ID[id].title}</span>
						<span>$0.00</span>
					</div>
				{/each}
			{/if}
			<div class="receipt-total">
				<span>TOTAL</span>
				<span>$0.00</span>
			</div>
		</div>
	</div>

	<!-- Empty cart message -->
	{#if cart.length === 0}
		<div class="empty-msg">
			cart is empty.<br />
			<span class="empty-sub">grab something off a shelf.</span>
		</div>
	{/if}

	<!-- CART ITEMS on counter -->
	{#if cart.length > 0}
		<div class="cart-items">
			{#each cart as id (id)}
				<div class="cart-item">
					<button class="remove-btn" onclick={() => onremove(id)} title="remove">
						&times; remove
					</button>
					<SoftwareBox app={APP_BY_ID[id]} width={60} height={82} hoverable={false} />
				</div>
			{/each}
		</div>
	{/if}

	<!-- REGISTER -->
	<div class="register">
		<div class="register-display">
			${(cart.length * 0).toFixed(2)}
		</div>
		<div class="register-keys">
			{#each Array(12) as _, i (i)}
				<div class="register-key"></div>
			{/each}
		</div>
	</div>

	<!-- COUNTER bottom strip -->
	<div class="counter-strip">
		<!-- counter top -->
		<div class="counter-top">
			<div class="counter-top-grain"></div>
		</div>
		<!-- counter face -->
		<div class="counter-face">
			<div class="counter-face-grain"></div>
			<div class="face-sign face-sign-returns">NO RETURNS</div>
			<div class="face-sign face-sign-cash">CASH ONLY*</div>
			<div class="face-disclaimer">* there is no cash. everything is free.</div>

			<!-- RING ME UP button -->
			<button
				class="ring-btn"
				class:ring-btn-active={cart.length > 0}
				disabled={cart.length === 0}
				onclick={cart.length > 0 ? onringup : undefined}
			>
				&#x25B8; RING ME UP
			</button>
		</div>
	</div>
</div>

<style>
	.counter-view {
		position: absolute;
		inset: 0;
		background: #f5b34f;
		overflow: hidden;
	}
	.wall {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		bottom: 220px;
		background: #f5b34f;
	}
	.floor {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 220px;
		background: #cbd5cb;
	}
	.seam {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 220px;
		height: 6px;
		background: #f54e00;
		border-top: 2px solid #0a0a0a;
		border-bottom: 2px solid #0a0a0a;
	}

	/* CHECKOUT sign */
	.sign-area {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 90px;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 8px;
	}
	.sign-holder {
		position: relative;
	}
	.sign-cord {
		position: absolute;
		top: -8px;
		width: 2px;
		height: 14px;
		background: #0a0a0a;
	}
	.sign-cord-left {
		left: 20px;
	}
	.sign-cord-right {
		right: 20px;
	}
	.checkout-sign {
		background: #0a0a0a;
		color: #f9bd2b;
		border: 3px solid #0a0a0a;
		box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.45);
		padding: 10px 28px;
		font-family: 'Press Start 2P', monospace;
		font-size: 16px;
		letter-spacing: 0.08em;
		text-align: center;
		white-space: nowrap;
	}
	.sign-sub {
		font-family: 'VT323', monospace;
		font-size: 14px;
		color: #ffffff;
		margin-top: 6px;
		letter-spacing: 0;
	}
	.sign-you {
		color: #f54e00;
	}

	/* RECEIPT */
	.receipt {
		position: absolute;
		left: 20px;
		top: 100px;
		width: 200px;
		background: #fffceb;
		border: 2px solid #0a0a0a;
		box-shadow: 4px 4px 0 #0a0a0a;
		font-family: 'VT323', monospace;
		font-size: 15px;
		background-image: repeating-linear-gradient(
			0deg,
			transparent 0 22px,
			rgba(0, 0, 0, 0.05) 22px 23px
		);
		z-index: 3;
	}
	.receipt-header {
		background: #0a0a0a;
		color: #f9bd2b;
		padding: 5px 8px;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 0.04em;
	}
	.receipt-body {
		padding: 6px 8px;
		max-height: 130px;
		overflow-y: auto;
	}
	.receipt-empty {
		color: rgba(10, 10, 10, 0.5);
		font-style: italic;
	}
	.receipt-line {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px dotted rgba(0, 0, 0, 0.3);
		padding: 1px 0;
	}
	.receipt-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.receipt-total {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		padding-top: 5px;
		border-top: 2px solid #0a0a0a;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
	}

	/* Empty cart message */
	.empty-msg {
		position: absolute;
		left: 50%;
		top: 200px;
		transform: translateX(-50%);
		font-family: 'VT323', monospace;
		font-size: 17px;
		color: rgba(10, 10, 10, 0.7);
		background: #ffffff;
		border: 2px dashed #0a0a0a;
		padding: 10px 14px;
		text-align: center;
		line-height: 1.3;
		max-width: 280px;
		z-index: 2;
	}
	.empty-sub {
		opacity: 0.7;
	}

	/* Cart items */
	.cart-items {
		position: absolute;
		left: 240px;
		right: 180px;
		top: 100px;
		height: 202px;
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 0 4px 0 8px;
		z-index: 2;
	}
	.cart-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.remove-btn {
		background: transparent;
		color: #0a0a0a;
		border: none;
		font-family: 'Press Start 2P', monospace;
		font-size: 7px;
		cursor: pointer;
		margin-bottom: 2px;
		padding: 2px;
	}

	/* Register */
	.register {
		position: absolute;
		right: 28px;
		bottom: 200px;
		width: 116px;
		height: 108px;
		background: #dcd6c8;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		z-index: 2;
	}
	.register-display {
		position: absolute;
		left: 8px;
		top: 6px;
		right: 8px;
		height: 28px;
		background: #a6f000;
		border: 2px solid #0a0a0a;
		font-family: 'VT323', monospace;
		font-size: 18px;
		text-align: right;
		padding: 2px 6px;
		color: #0a0a0a;
	}
	.register-keys {
		position: absolute;
		left: 8px;
		top: 40px;
		right: 8px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 3px;
	}
	.register-key {
		aspect-ratio: 1 / 1;
		background: #0a0a0a;
	}

	/* Counter strip */
	.counter-strip {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 24px;
		height: 196px;
	}
	.counter-top {
		position: absolute;
		left: 16px;
		right: 16px;
		top: 0;
		height: 30px;
		background: #a06a3a;
		border: 2px solid #0a0a0a;
		box-shadow: 0 4px 0 #7a4f2a;
	}
	.counter-top-grain {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(90deg, transparent 0 40px, rgba(0, 0, 0, 0.18) 40px 42px);
	}
	.counter-face {
		position: absolute;
		left: 16px;
		right: 16px;
		top: 30px;
		bottom: 0;
		background: #7a4f2a;
		border: 2px solid #0a0a0a;
		border-top: none;
	}
	.counter-face-grain {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(90deg, transparent 0 70px, rgba(0, 0, 0, 0.25) 70px 72px);
	}
	.face-sign {
		position: absolute;
		top: 14px;
		border: 2px solid #0a0a0a;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 4px 8px;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
	}
	.face-sign-returns {
		left: 12px;
		background: #ffffff;
		color: #0a0a0a;
	}
	.face-sign-cash {
		left: 140px;
		background: #f9bd2b;
		color: #0a0a0a;
	}
	.face-disclaimer {
		position: absolute;
		left: 270px;
		top: 18px;
		font-family: 'VT323', monospace;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.65);
		white-space: nowrap;
	}
	.ring-btn {
		position: absolute;
		right: 18px;
		bottom: 16px;
		background: #888888;
		color: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		padding: 12px 18px;
		font-family: 'Press Start 2P', monospace;
		font-size: 13px;
		letter-spacing: 0.06em;
		cursor: not-allowed;
	}
	.ring-btn-active {
		background: #f54e00;
		cursor: pointer;
	}
</style>
