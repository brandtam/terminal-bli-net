<script lang="ts">
	import { getOwnedAppIds, getAppDef } from '$lib/terminalos';
	import { getAppContext } from '$lib/os/os-context';
	import TopBar from './TopBar.svelte';
	import AisleView from './AisleView.svelte';
	import CategoryCloseup from './CategoryCloseup.svelte';
	import CounterView from './CounterView.svelte';
	import BoxDetailModal from './BoxDetailModal.svelte';
	import ReceiptOverlay from './ReceiptOverlay.svelte';
	import { CATEGORIES, APP_BY_ID, type StoreApp, type CategoryId } from './store-data';

	// Zero-prop: reads os/fs from the host-provided context, no props.
	const { os, fs } = getAppContext();

	let view = $state<string>('aisle');
	let cart = $state<string[]>([]);
	let pickedUp = $state<StoreApp | null>(null);
	let receipt = $state<{ purchases: string[]; returns: string[] } | null>(null);
	let tweaksOpen = $state(false);
	let shelfT = $state({
		games: { scale: 1.0, tilt: 20, x: 12, y: 110 },
		ent: { scale: 1.0, tilt: -22, x: 0, y: 80 },
		business: { scale: 1.0, tilt: 0, x: 186, y: 97 },
		counter: { scale: 1.0, tilt: 0, x: 380, y: 56 }
	});

	let ownedVersion = $state(0);
	const owned = $derived.by(() => {
		ownedVersion;
		return getOwnedAppIds(fs.getOwnedApps());
	});

	const breadcrumb = $derived(
		view === 'aisle'
			? 'browse'
			: view === 'counter'
				? '▸ at the counter'
				: `▸ ${CATEGORIES[view]?.label ?? ''} aisle`
	);

	function addToCart(id: string) {
		if (getAppDef(id)?.status === 'coming-soon') return;
		if (!cart.includes(id)) cart = [...cart, id];
	}

	function removeFromCart(id: string) {
		cart = cart.filter((x) => x !== id);
	}

	async function ringUp() {
		if (cart.length === 0) return;
		for (const id of cart) {
			if (getAppDef(id)?.status === 'coming-soon') continue;
			if (!fs.isAppOwned(id)) {
				const result = await fs.buyApp(id);
				if (!result.ok) {
					os.alert({
						title: 'Purchase Failed',
						body: result.error.message,
						buttons: [{ label: 'OK', primary: true }]
					});
					return;
				}
			}
		}
		ownedVersion++;
		receipt = { purchases: [...cart], returns: [] };
		cart = [];
		view = 'aisle';
	}

	async function returnToStore(id: string) {
		const result = await fs.returnApp(id);
		if (!result.ok) {
			os.alert({
				title: 'Return Failed',
				body: result.error.message,
				buttons: [{ label: 'OK', primary: true }]
			});
			return;
		}
		ownedVersion++;
		pickedUp = null;
		view = 'counter';
		receipt = { purchases: [], returns: [id] };
	}
</script>

<div class="store-root">
	<TopBar
		{view}
		{breadcrumb}
		onback={view === 'aisle'
			? null
			: () => {
					view = 'aisle';
				}}
		cartCount={cart.length}
		oncart={() => {
			view = 'counter';
		}}
	/>
	<div class="store-body">
		{#if view === 'aisle'}
			<AisleView
				onenter={(v) => {
					view = v;
				}}
				{shelfT}
				{tweaksOpen}
				onopentweaks={() => {
					tweaksOpen = true;
				}}
				onclosetweaks={() => {
					tweaksOpen = false;
				}}
				onupdatetweaks={(id, patch) => {
					const key = id as keyof typeof shelfT;
					shelfT = { ...shelfT, [key]: { ...shelfT[key], ...patch } };
				}}
			/>
		{/if}
		{#if view === 'games' || view === 'business' || view === 'ent'}
			<CategoryCloseup
				categoryId={view as CategoryId}
				{cart}
				{owned}
				onpickup={(app) => {
					pickedUp = app;
				}}
			/>
		{/if}
		{#if view === 'counter'}
			<CounterView {cart} onremove={removeFromCart} onringup={ringUp} />
		{/if}
		{#if pickedUp}
			<BoxDetailModal
				app={pickedUp}
				owned={owned.includes(pickedUp.id)}
				inCart={cart.includes(pickedUp.id)}
				comingSoon={getAppDef(pickedUp.id)?.status === 'coming-soon'}
				onclose={() => {
					pickedUp = null;
				}}
				onaddtocart={() => {
					addToCart(pickedUp!.id);
					pickedUp = null;
				}}
				onremovefromcart={() => {
					removeFromCart(pickedUp!.id);
					pickedUp = null;
				}}
				onreturn={() => returnToStore(pickedUp!.id)}
			/>
		{/if}
		{#if receipt}
			<ReceiptOverlay
				purchases={receipt.purchases}
				returns={receipt.returns}
				onclose={() => {
					receipt = null;
				}}
				onleave={() => {
					receipt = null;
					os.closeWindow('computer-store');
				}}
			/>
		{/if}
	</div>
</div>

<style>
	.store-root {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		font-family: 'Pixelify Sans', sans-serif;
		-webkit-font-smoothing: none;
	}
	.store-body {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
