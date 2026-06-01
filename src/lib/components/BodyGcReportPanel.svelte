<script lang="ts">
	import type { BodyGcReport, FsError } from '$lib/terminalos';
	import {
		bodyGcFailedBodyIds,
		bodyGcReportRows,
		bodyGcReportStatus,
		type BodyGcReportStatus
	} from './body-gc-report';

	let {
		report = null,
		error = null,
		running = false,
		onrun
	}: {
		report?: BodyGcReport | null;
		error?: FsError | null;
		running?: boolean;
		onrun?: () => void;
	} = $props();

	const idleStatus: BodyGcReportStatus = {
		label: 'READY',
		tone: 'idle',
		detail: 'No scan report.'
	};

	const rows = $derived(report ? bodyGcReportRows(report) : []);
	const failedBodyIds = $derived(report ? bodyGcFailedBodyIds(report) : []);
	const status = $derived(error ? null : report ? bodyGcReportStatus(report) : idleStatus);
</script>

<section class="gc-report" aria-labelledby="body-gc-title">
	<div class="gc-head">
		<div class="gc-title-block">
			<h3 id="body-gc-title">BODY GARBAGE COLLECTION</h3>
			{#if status}
				<div class="gc-status gc-status-{status.tone}" data-testid="body-gc-status">
					<span>{status.label}</span>
					<small>{status.detail}</small>
				</div>
			{:else if error}
				<div class="gc-status gc-status-warn" data-testid="body-gc-status">
					<span>SCAN FAILED</span>
					<small>{error.code}</small>
				</div>
			{/if}
		</div>
		<button
			class="btn primary gc-run"
			type="button"
			disabled={running}
			aria-busy={running}
			onclick={() => onrun?.()}
		>
			{running ? 'Scanning...' : 'Run GC'}
		</button>
	</div>

	{#if error}
		<div class="gc-error" data-testid="body-gc-error">
			<div class="gc-error-label">error</div>
			<p>{error.message}</p>
		</div>
	{:else if report}
		<div class="gc-grid" data-testid="body-gc-report">
			{#each rows as row (row.key)}
				<div class="gc-metric" data-field={row.key}>
					<div class="gc-metric-label">{row.label}</div>
					<div class="gc-metric-value">{row.value.toLocaleString()}</div>
				</div>
			{/each}
		</div>

		<div class="gc-failed-list" data-field="failedBodyIds">
			<div class="gc-list-label">failedBodyIds</div>
			{#if failedBodyIds.length === 0}
				<div class="gc-empty">none</div>
			{:else}
				<ul>
					{#each failedBodyIds as bodyId (bodyId)}
						<li>{bodyId}</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="gc-empty-state">Awaiting scan.</div>
	{/if}
</section>

<style>
	.gc-report {
		display: flex;
		flex-direction: column;
		gap: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.25;
	}

	.gc-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		border-bottom: 2px solid var(--ink);
	}

	.gc-title-block {
		min-width: 0;
	}

	h3 {
		margin: 0 0 8px;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		font-weight: normal;
		line-height: 1.35;
	}

	.gc-status {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
	}

	.gc-status span {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		letter-spacing: 0.05em;
		padding: 4px 6px;
		border: 2px solid var(--ink);
		background: var(--paper-soft);
	}

	.gc-status small {
		font-size: 15px;
		opacity: 0.75;
	}

	.gc-status-ok span {
		background: var(--accent-2);
	}

	.gc-status-warn span {
		background: var(--accent);
		color: var(--paper);
	}

	.gc-status-idle span {
		background: var(--paper);
	}

	.gc-run {
		flex-shrink: 0;
		min-width: 92px;
		text-align: center;
	}

	.gc-run:disabled {
		opacity: 0.55;
		cursor: progress;
		transform: none;
		box-shadow: 3px 3px 0 var(--ink);
	}

	.gc-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border: 2px solid var(--ink);
	}

	.gc-metric {
		min-width: 0;
		padding: 10px 8px;
		border-right: 2px solid var(--ink);
		background: var(--paper);
	}

	.gc-metric:last-child {
		border-right: 0;
	}

	.gc-metric-label,
	.gc-list-label,
	.gc-error-label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.gc-metric-value {
		margin-top: 8px;
		font-size: 26px;
		line-height: 1;
	}

	.gc-failed-list,
	.gc-error,
	.gc-empty-state {
		border: 2px solid var(--ink);
		background: var(--paper);
		padding: 10px;
	}

	.gc-failed-list ul {
		margin: 8px 0 0;
		padding-left: 18px;
		max-height: 96px;
		overflow: auto;
		font-size: 16px;
	}

	.gc-failed-list li {
		font-family: var(--brand-font-body, 'VT323', monospace);
		word-break: break-all;
	}

	.gc-empty,
	.gc-empty-state {
		margin-top: 8px;
		opacity: 0.7;
	}

	.gc-error p {
		margin: 8px 0 0;
	}

	@media (max-width: 560px) {
		.gc-head {
			flex-direction: column;
		}

		.gc-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.gc-metric {
			border-right: 0;
			border-bottom: 2px solid var(--ink);
		}

		.gc-metric:nth-child(odd) {
			border-right: 2px solid var(--ink);
		}

		.gc-metric:nth-last-child(-n + 1) {
			border-bottom: 0;
		}
	}
</style>
