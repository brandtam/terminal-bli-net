<script lang="ts">
	import type { OsApi } from '$lib/os/os-api';
	import type { TerminalFS } from '$lib/terminalos';
	import type { DiskUsage } from '$lib/terminalos';

	let { os, fs }: { os: OsApi; fs: TerminalFS } = $props();

	const version = __APP_VERSION__;

	function getLocalStorageBytes(): number {
		let total = 0;
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key) {
				total += key.length * 2 + (localStorage.getItem(key)?.length ?? 0) * 2;
			}
		}
		return total;
	}

	const storageUsed = $derived(getLocalStorageBytes());
	const storageQuota = 5 * 1024 * 1024; // 5MB typical localStorage quota

	function formatK(bytes: number): string {
		return `${Math.round(bytes / 1024).toLocaleString()}K`;
	}

	let diskUsage = $state<DiskUsage | null>(null);

	$effect(() => {
		fs.getDiskUsage().then((result) => {
			if (result.ok) diskUsage = result.value;
		});
	});

	const appUsage = $derived.by(() => {
		if (!diskUsage) return [];
		const apps = [
			{ id: 'textedit', name: 'TextEdit' },
			{ id: 'stickies', name: 'Stickies' },
			{ id: 'recorder', name: 'Camera' }
		];
		const result: { name: string; bytes: number; count: number }[] = [];
		for (const app of apps) {
			const files = fs.findByApp(app.id);
			let bytes = 0;
			for (const f of files) {
				if (f.bodyRef?.kind === 'inline-text') {
					bytes += f.bodyRef.text.length * 2;
				}
			}
			if (bytes > 0 || files.length > 0) {
				result.push({ name: app.name, bytes, count: files.length });
			}
		}
		const appTotal = result.reduce((s, a) => s + a.bytes, 0);
		const systemBytes = diskUsage.totalEstimatedBytes - appTotal;
		result.unshift({ name: 'System', bytes: Math.max(0, systemBytes), count: 0 });
		return result;
	});

	const barMax = storageQuota;
</script>

<div class="about-terminal">
	<div class="about-header">
		<div class="about-icon">:)</div>
		<div class="about-info">
			<div class="about-name">Terminal</div>
			<div class="about-version">System Software v{version}</div>
			<div class="about-copyright">terminal.bli.net</div>
		</div>
	</div>
	<div class="about-memory-header">
		<span>Built-in Memory: {formatK(storageQuota)}</span>
		<span>Disk Used: {formatK(storageUsed)}</span>
	</div>
	<div class="about-bars">
		<div class="about-bar-row">
			<span class="about-bar-name">Total</span>
			<span class="about-bar-size">{formatK(storageUsed)}</span>
			<div class="about-bar-track">
				<div
					class="about-bar-fill"
					style="width: {Math.min(100, (storageUsed / storageQuota) * 100)}%"
				></div>
			</div>
		</div>
		{#each appUsage as app}
			<div class="about-bar-row">
				<span class="about-bar-name">{app.name}</span>
				<span class="about-bar-size">{formatK(app.bytes)}</span>
				<div class="about-bar-track">
					<div
						class="about-bar-fill"
						style="width: {Math.min(100, (app.bytes / barMax) * 100)}%"
					></div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.about-terminal {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
	}
	.about-header {
		display: flex;
		gap: 14px;
		align-items: center;
		padding-bottom: 12px;
		border-bottom: 2px solid var(--ink);
		margin-bottom: 12px;
	}
	.about-icon {
		width: 48px;
		height: 48px;
		border: 2px solid var(--ink);
		display: grid;
		place-items: center;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 16px;
		background: var(--accent-2);
		flex-shrink: 0;
	}
	.about-name {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 14px;
	}
	.about-version {
		font-size: 16px;
		opacity: 0.8;
		margin-top: 2px;
	}
	.about-copyright {
		font-size: 14px;
		opacity: 0.6;
		margin-top: 1px;
	}
	.about-memory-header {
		display: flex;
		justify-content: space-between;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		margin-bottom: 10px;
		opacity: 0.7;
	}
	.about-bars {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.about-bar-row {
		display: grid;
		grid-template-columns: 100px 50px 1fr;
		align-items: center;
		gap: 8px;
		font-size: 15px;
	}
	.about-bar-name {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.about-bar-size {
		font-size: 14px;
		text-align: right;
		opacity: 0.7;
	}
	.about-bar-track {
		height: 12px;
		background: var(--paper-soft);
		border: 2px solid var(--ink);
	}
	.about-bar-fill {
		height: 100%;
		background: var(--ink);
	}
</style>
