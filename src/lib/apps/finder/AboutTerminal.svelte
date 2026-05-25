<script lang="ts">
	import type { OsApi } from '$lib/os/os-api';
	import { windowAppId } from '$lib/os/os-api';
	import { APPS } from '$lib/os/app-registry';

	let { os }: { os: OsApi } = $props();

	const version = __APP_VERSION__;

	/** Deterministic fake memory from app name — stable across re-renders */
	function fakeMemory(name: string): number {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
		}
		return 400 + Math.abs(hash % 1200);
	}

	const maxMem = 2048;

	const openApps = $derived.by(() => {
		const wins = os.listWindows();
		const appCounts = new Map<string, number>();
		for (const w of wins) {
			const appId = windowAppId(w.id);
			const app = APPS[appId];
			if (app) {
				appCounts.set(app.name, (appCounts.get(app.name) ?? 0) + 1);
			}
		}
		return Array.from(appCounts.entries()).map(([name, count]) => ({
			name,
			count,
			memory: fakeMemory(name) * count,
			pct: Math.min(100, ((fakeMemory(name) * count) / maxMem) * 100)
		}));
	});
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
		<span>Built-in Memory: &infin;</span>
		<span>Total Memory: &infin;</span>
	</div>
	<div class="about-bars">
		{#each openApps as app}
			<div class="about-bar-row">
				<span class="about-bar-name">{app.name}</span>
				<span class="about-bar-size">{app.memory}K</span>
				<div class="about-bar-track">
					<div class="about-bar-fill" style="width: {app.pct}%"></div>
				</div>
			</div>
		{/each}
		{#if openApps.length === 0}
			<div class="about-bar-empty">No apps open</div>
		{/if}
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
	.about-bar-empty {
		font-size: 16px;
		opacity: 0.5;
		padding: 12px 0;
	}
</style>
