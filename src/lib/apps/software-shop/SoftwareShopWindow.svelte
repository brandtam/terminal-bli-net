<script lang="ts">
	import {
		TerminalFS,
		LocalStorageManifestStore,
		getShopCatalog,
		canUninstall
	} from '$lib/terminalos';
	import type { ShopItem } from '$lib/terminalos';
	import type { OsApi } from '$lib/os/os-api';

	let { os }: { os: OsApi } = $props();

	let catalog = $state<ShopItem[]>([]);
	let loading = $state(true);
	let busy = $state<string | null>(null);

	async function load() {
		loading = true;
		const fs = await TerminalFS.open(new LocalStorageManifestStore());
		catalog = getShopCatalog(fs.getAllNodes());
		loading = false;
	}

	load();

	async function install(appId: string) {
		busy = appId;
		const fs = await TerminalFS.open(new LocalStorageManifestStore());
		const result = await fs.installApp(appId);
		if (result.ok) {
			await load();
			window.location.reload();
		} else {
			os.alert({
				title: 'Install Failed',
				body: result.error.message,
				buttons: [{ label: 'OK', primary: true }]
			});
		}
		busy = null;
	}

	async function uninstall(appId: string, appName: string) {
		os.alert({
			title: `Uninstall ${appName}?`,
			body: `"${appName}" will be removed. Your documents will not be deleted. You can reinstall it from Software Shop any time.`,
			buttons: [
				{ label: 'Cancel' },
				{
					label: 'Uninstall',
					primary: true,
					action: async () => {
						busy = appId;
						const fs = await TerminalFS.open(new LocalStorageManifestStore());
						const result = await fs.uninstallApp(appId);
						if (result.ok) {
							await load();
							window.location.reload();
						} else {
							os.alert({
								title: 'Uninstall Failed',
								body: result.error.message,
								buttons: [{ label: 'OK', primary: true }]
							});
						}
						busy = null;
					}
				}
			]
		});
	}
</script>

<div class="shop">
	<div class="shop-header">
		<div class="shop-title">Software Shop</div>
		<div class="shop-subtitle">Install from Floppy or uninstall apps from your Terminal.</div>
	</div>

	{#if loading}
		<div class="shop-loading">Loading catalog…</div>
	{:else}
		<div class="shop-list">
			{#each catalog as item (item.app.id)}
				<div class="shop-item">
					<div class="shop-item-icon">{item.app.icon}</div>
					<div class="shop-item-info">
						<div class="shop-item-name">{item.app.name}</div>
						<div class="shop-item-desc">{item.app.description}</div>
						<div class="shop-item-cat">{item.app.category}</div>
					</div>
					<div class="shop-item-action">
						{#if item.installed}
							{#if canUninstall(item.app.id)}
								<button
									class="btn"
									disabled={busy === item.app.id}
									onclick={() => uninstall(item.app.id, item.app.name)}
								>
									{busy === item.app.id ? 'Working…' : 'Uninstall'}
								</button>
							{:else}
								<span class="shop-protected">Core</span>
							{/if}
						{:else}
							<button
								class="btn primary"
								disabled={busy === item.app.id}
								onclick={() => install(item.app.id)}
							>
								{busy === item.app.id ? 'Installing…' : 'Install from Floppy'}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.shop {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--paper, #fff);
		font-family: var(--brand-font-body, 'VT323', monospace);
	}

	.shop-header {
		padding: 14px 16px 10px;
		border-bottom: 2px solid var(--ink, #0a0a0a);
		background: var(--paper-soft, #f5f0e8);
	}

	.shop-title {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		margin-bottom: 6px;
		color: var(--ink, #0a0a0a);
	}

	.shop-subtitle {
		font-size: 17px;
		color: var(--ink, #0a0a0a);
		opacity: 0.7;
	}

	.shop-loading {
		padding: 40px 16px;
		text-align: center;
		font-size: 18px;
		opacity: 0.5;
		color: var(--ink, #0a0a0a);
	}

	.shop-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.shop-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--ink, #0a0a0a);
		border-bottom-style: dotted;
	}

	.shop-item:last-child {
		border-bottom: none;
	}

	.shop-item-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--paper-soft, #f5f0e8);
		border: 2px solid var(--ink, #0a0a0a);
		flex-shrink: 0;
	}

	.shop-item-info {
		flex: 1;
		min-width: 0;
	}

	.shop-item-name {
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 14px;
		font-weight: bold;
		color: var(--ink, #0a0a0a);
	}

	.shop-item-desc {
		font-size: 16px;
		color: var(--ink, #0a0a0a);
		opacity: 0.8;
	}

	.shop-item-cat {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 7px;
		text-transform: uppercase;
		opacity: 0.4;
		margin-top: 2px;
		color: var(--ink, #0a0a0a);
	}

	.shop-item-action {
		flex-shrink: 0;
	}

	.shop-protected {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		opacity: 0.4;
		color: var(--ink, #0a0a0a);
	}
</style>
