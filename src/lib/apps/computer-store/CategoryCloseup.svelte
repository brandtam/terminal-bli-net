<script lang="ts">
	import SoftwareBox from './SoftwareBox.svelte';
	import { CATEGORIES, APP_BY_ID, type StoreApp, type CategoryId } from './store-data';

	let {
		categoryId,
		cart,
		owned,
		onpickup
	}: {
		categoryId: CategoryId;
		cart: string[];
		owned: string[];
		onpickup: (app: StoreApp) => void;
	} = $props();

	const cat = $derived(CATEGORIES[categoryId]);
	const apps = $derived(cat.appIds.map((id) => APP_BY_ID[id]));
</script>

<div class="closeup">
	<div class="wall"></div>

	<!-- Hanging aisle sign -->
	<div class="sign-wrap">
		<div class="cord left-cord"></div>
		<div class="cord right-cord"></div>
		<div class="sign" style:background={cat.color}>
			AISLE &middot; {cat.label}
			<div class="sign-tagline">{cat.tagline}</div>
		</div>
	</div>

	<!-- Shelf and boxes -->
	<div class="shelf-area">
		<div class="boxes">
			{#each apps as app (app.id)}
				<SoftwareBox
					{app}
					onclick={() => onpickup(app)}
					status={owned.includes(app.id)
						? 'installed'
						: cart.includes(app.id)
							? 'in-cart'
							: undefined}
				/>
			{/each}
		</div>
		<div class="shelf-plank"></div>
		<div class="shelf-shadow"></div>

		<!-- Manager's Special rail -->
		<div class="mgr-special">
			<span class="mgr-label">&#x2605; MGR. SPECIAL</span>
			<span class="mgr-dash">&mdash;</span>
			<span class="mgr-text">everything in this aisle is $0.00 (tips welcome)</span>
		</div>
	</div>
</div>

<style>
	.closeup {
		position: absolute;
		inset: 0;
		background: #f5b34f;
		overflow: hidden;
	}
	.wall {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(90deg, #f5b34f 0 78px, #e8a73f 78px 80px);
	}
	.sign-wrap {
		position: absolute;
		left: 50%;
		top: 14px;
		transform: translateX(-50%);
		z-index: 2;
	}
	.cord {
		position: absolute;
		top: -14px;
		width: 2px;
		height: 14px;
		background: #0a0a0a;
	}
	.left-cord {
		left: 20px;
	}
	.right-cord {
		right: 20px;
	}
	.sign {
		color: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		padding: 8px 22px;
		font-family: 'Press Start 2P', monospace;
		font-size: 12px;
		letter-spacing: 0.06em;
		text-align: center;
		white-space: nowrap;
	}
	.sign-tagline {
		font-family: 'VT323', monospace;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.85);
		margin-top: 4px;
		letter-spacing: 0;
		white-space: nowrap;
	}
	.shelf-area {
		position: absolute;
		left: 24px;
		right: 24px;
		bottom: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.boxes {
		display: flex;
		align-items: flex-end;
		gap: 18px;
		margin-bottom: 0;
	}
	.shelf-plank {
		width: 100%;
		height: 14px;
		background: #a06a3a;
		border: 2px solid #0a0a0a;
		box-shadow: 0 4px 0 #7a4f2a;
		margin-top: 0;
	}
	.shelf-shadow {
		width: 92%;
		height: 6px;
		background: rgba(0, 0, 0, 0.18);
		margin-top: 10px;
	}
	.mgr-special {
		margin-top: 10px;
		background: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		padding: 6px 14px;
		font-family: 'VT323', monospace;
		font-size: 15px;
		text-align: center;
		max-width: 540px;
	}
	.mgr-label {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #f54e00;
		letter-spacing: 0.04em;
	}
	.mgr-dash {
		margin: 0 8px;
	}
</style>
