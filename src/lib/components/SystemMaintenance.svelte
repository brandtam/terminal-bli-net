<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getAppContext } from '$lib/os/os-context';
	import type { BodyGcReport, FsError } from '$lib/terminalos';
	import { createDiskUsageView } from '$lib/terminalos';
	import {
		estimateCapacity,
		formatBytes,
		isNearCapacity,
		type CapacityEstimate
	} from '$lib/os/capacity';
	import BodyGcReportPanel from './BodyGcReportPanel.svelte';

	const { os, fs } = getAppContext();

	let report = $state<BodyGcReport | null>(null);
	let error = $state<FsError | null>(null);
	let running = $state(false);

	// Live Terminal HD numbers — the view re-reads on every fs change.
	const usageView = createDiskUsageView(fs);
	const usage = $derived(usageView.usage);

	let capacity = $state<CapacityEstimate | null>(null);
	let capacityChecked = $state(false);

	const nearCapacity = $derived(isNearCapacity(capacity));

	async function refreshCapacity(): Promise<void> {
		capacity = await estimateCapacity();
		capacityChecked = true;
	}

	async function runGarbageCollection(): Promise<void> {
		if (running) return;

		running = true;
		error = null;

		try {
			const result = await os.collectFilesystemGarbage();
			if (result.ok) {
				report = result.value;
			} else {
				report = null;
				error = result.error;
			}
		} catch (e) {
			report = null;
			error = {
				code: 'corrupt_disk',
				message: e instanceof Error ? e.message : 'Garbage collection failed unexpectedly.'
			};
		} finally {
			running = false;
			// GC can free blob bytes — keep the gauges honest after a scan.
			void usageView.refresh();
			void refreshCapacity();
		}
	}

	onMount(() => {
		void refreshCapacity();
	});

	onDestroy(() => {
		usageView.destroy();
	});
</script>

<div class="window-content maintenance-content">
	<section class="storage-panel" aria-labelledby="storage-title">
		<h3 id="storage-title">DISK CAPACITY</h3>

		{#if capacityChecked}
			{#if capacity}
				<div class="capacity-row" data-testid="capacity-estimate">
					<span class="capacity-label">Browser storage</span>
					<span class="capacity-value" class:capacity-warn={nearCapacity}>
						{formatBytes(capacity.usageBytes)} of {formatBytes(capacity.quotaBytes)} used ({Math.round(
							capacity.ratio * 100
						)}%)
					</span>
				</div>
				<div class="capacity-bar" aria-hidden="true">
					<div
						class="capacity-bar-fill"
						class:capacity-bar-warn={nearCapacity}
						style="width: {Math.min(100, Math.round(capacity.ratio * 100))}%;"
					></div>
				</div>
				{#if nearCapacity}
					<p class="capacity-hint">
						Disk almost full — empty the Trash or delete old recordings to free up space.
					</p>
				{/if}
			{:else}
				<p class="capacity-hint" data-testid="capacity-unavailable">
					This browser does not report a storage estimate.
				</p>
			{/if}
		{/if}

		{#if usage}
			<div class="usage-grid" data-testid="disk-usage">
				<div class="usage-metric">
					<div class="usage-metric-label">files</div>
					<div class="usage-metric-value">{usage.fileCount.toLocaleString()}</div>
				</div>
				<div class="usage-metric">
					<div class="usage-metric-label">folders</div>
					<div class="usage-metric-value">{usage.folderCount.toLocaleString()}</div>
				</div>
				<div class="usage-metric">
					<div class="usage-metric-label">text</div>
					<div class="usage-metric-value">{formatBytes(usage.inlineTextBytes)}</div>
				</div>
				<div class="usage-metric">
					<div class="usage-metric-label">clips + blobs</div>
					<div class="usage-metric-value">{formatBytes(usage.blobBytes)}</div>
				</div>
				<div class="usage-metric">
					<div class="usage-metric-label">total</div>
					<div class="usage-metric-value">{formatBytes(usage.totalEstimatedBytes)}</div>
				</div>
			</div>
		{/if}
	</section>

	<BodyGcReportPanel {report} {error} {running} onrun={runGarbageCollection} />
</div>

<style>
	.window-content {
		padding: 14px;
	}

	.maintenance-content {
		height: 100%;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.storage-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.25;
	}

	h3 {
		margin: 0;
		padding-bottom: 10px;
		border-bottom: 2px solid var(--ink);
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		font-weight: normal;
		line-height: 1.35;
	}

	.capacity-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
	}

	.capacity-label {
		opacity: 0.75;
	}

	.capacity-warn {
		color: var(--accent);
	}

	.capacity-bar {
		height: 14px;
		border: 2px solid var(--ink);
		background: var(--paper);
	}

	.capacity-bar-fill {
		height: 100%;
		background: var(--accent-2);
	}

	.capacity-bar-warn {
		background: var(--accent);
	}

	.capacity-hint {
		margin: 0;
		opacity: 0.75;
	}

	.usage-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border: 2px solid var(--ink);
	}

	.usage-metric {
		min-width: 0;
		padding: 10px 8px;
		border-right: 2px solid var(--ink);
		background: var(--paper);
	}

	.usage-metric:last-child {
		border-right: 0;
	}

	.usage-metric-label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.usage-metric-value {
		margin-top: 8px;
		font-size: 22px;
		line-height: 1;
		overflow-wrap: anywhere;
	}

	@media (max-width: 560px) {
		.usage-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.usage-metric {
			border-right: 0;
			border-bottom: 2px solid var(--ink);
		}

		.usage-metric:nth-child(odd) {
			border-right: 2px solid var(--ink);
		}

		.usage-metric:nth-last-child(-n + 1) {
			border-bottom: 0;
		}
	}
</style>
