<script lang="ts">
	import SoftwareBox from './SoftwareBox.svelte';
	import { type StoreApp, CATEGORIES, CAT_COLORS } from './store-data';

	const INK = '#0a0a0a';

	const CAT_TO_BOX: Record<string, string> = { games: 'GAMES', business: 'PROD', ent: 'ENT' };

	let {
		app,
		owned = false,
		inCart = false,
		onclose,
		onaddtocart,
		onremovefromcart,
		onreturn
	}: {
		app: StoreApp;
		owned?: boolean;
		inCart?: boolean;
		onclose: () => void;
		onaddtocart: () => void;
		onremovefromcart: () => void;
		onreturn: () => void;
	} = $props();

	const bandColor = $derived.by(() => {
		const catId = Object.keys(CATEGORIES).find((k) => CATEGORIES[k].appIds.includes(app.id));
		if (!catId) return INK;
		const boxKey = CAT_TO_BOX[catId];
		return boxKey ? (CAT_COLORS[boxKey]?.band ?? INK) : INK;
	});

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
	<div class="modal" onclick={(e) => e.stopPropagation()}>
		<!-- header -->
		<div class="header">
			<span>{owned || inCart ? '◂ DETAILS' : '◂ YOU PICKED IT UP'}</span>
			<button class="close-btn" onclick={onclose}
				>{owned || inCart ? '× CLOSE' : '× PUT BACK'}</button
			>
		</div>

		<!-- body -->
		<div class="body">
			<div class="box-col">
				<SoftwareBox {app} width={170} height={228} hoverable={false} lift />
				<div class="price"><span class="price-label">$0.00</span></div>
			</div>

			<div class="info-col">
				<div class="app-title">{app.title}</div>
				<div class="publisher" style:color={bandColor}>{app.pub}</div>

				<div class="back-copy">{app.back}</div>

				<div class="section-header">WHAT'S INSIDE:</div>
				<ul class="inside-list">
					{#each app.inside as line, i (i)}
						<li>▸ {line}</li>
					{/each}
				</ul>

				<div class="section-header reqs-header">REQUIRES:</div>
				<div class="reqs-text">{app.reqs}</div>
			</div>
		</div>

		<!-- actions -->
		<div class="actions">
			{#if owned}
				<div class="chip chip-owned">● ALREADY OWNED</div>
				<button class="btn btn-warn" onclick={onreturn}>RETURN TO STORE</button>
				<button class="btn btn-plain ml-auto" onclick={onclose}>× CLOSE</button>
			{:else if inCart}
				<div class="chip chip-cart">● IN YOUR CART</div>
				<button class="btn btn-warn" onclick={onremovefromcart}>TAKE OUT OF CART</button>
				<button class="btn btn-plain ml-auto" onclick={onclose}>× CLOSE</button>
			{:else}
				<button class="btn btn-primary" onclick={onaddtocart}>▸ ADD TO CART</button>
				<button class="btn btn-plain ml-auto" onclick={onclose}>◂ PUT BACK ON SHELF</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.scrim {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		width: 560px;
		max-width: 92%;
		background: #ffffff;
		border: 3px solid #0a0a0a;
		box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.55);
		display: flex;
		flex-direction: column;
		font-family: 'Pixelify Sans', sans-serif;
	}

	.header {
		background: #0a0a0a;
		color: #ffffff;
		padding: 8px 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		letter-spacing: 0.04em;
	}

	.close-btn {
		background: #ffffff;
		color: #0a0a0a;
		border: none;
		font-family: inherit;
		font-size: 10px;
		padding: 3px 8px;
		cursor: pointer;
	}

	.body {
		display: flex;
		padding: 18px;
		gap: 18px;
	}

	.box-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.price {
		font-family: 'VT323', monospace;
		font-size: 13px;
		color: rgba(0, 0, 0, 0.55);
		text-align: center;
	}

	.price-label {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
	}

	.info-col {
		flex: 1;
		min-width: 0;
		font-family: 'VT323', monospace;
		font-size: 16px;
		line-height: 1.3;
	}

	.app-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 14px;
		margin-bottom: 6px;
	}

	.publisher {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		margin-bottom: 10px;
		letter-spacing: 0.04em;
	}

	.back-copy {
		background: #f7f4ec;
		border-left: 4px solid #0a0a0a;
		padding: 8px 12px;
		margin-bottom: 14px;
		font-size: 16px;
		line-height: 1.35;
	}

	.section-header {
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		margin-bottom: 4px;
		color: #0a0a0a;
	}

	.reqs-header {
		margin-top: 10px;
	}

	.inside-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.inside-list li {
		padding: 1px 0;
	}

	.reqs-text {
		font-family: 'VT323', monospace;
		font-size: 16px;
	}

	.actions {
		padding: 12px 18px;
		border-top: 2px solid #0a0a0a;
		background: #f7f4ec;
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.chip {
		border: 2px solid #0a0a0a;
		padding: 5px 8px;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
	}

	.chip-owned {
		background: #a6f000;
	}

	.chip-cart {
		background: #f9bd2b;
	}

	.btn {
		font-family: 'Press Start 2P', monospace;
		font-size: 10px;
		letter-spacing: 0.04em;
		padding: 8px 12px;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		cursor: pointer;
	}

	.btn-primary {
		background: #f54e00;
		color: #ffffff;
	}

	.btn-warn {
		background: #f9bd2b;
		color: #0a0a0a;
	}

	.btn-plain {
		background: #ffffff;
		color: #0a0a0a;
	}

	.ml-auto {
		margin-left: auto;
	}
</style>
