<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';
	import type { BodyGcReport, FsError } from '$lib/terminalos';
	import BodyGcReportPanel from './BodyGcReportPanel.svelte';

	const { os } = getAppContext();

	let report = $state<BodyGcReport | null>(null);
	let error = $state<FsError | null>(null);
	let running = $state(false);

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
		}
	}
</script>

<div class="window-content maintenance-content">
	<BodyGcReportPanel {report} {error} {running} onrun={runGarbageCollection} />
</div>

<style>
	.window-content {
		padding: 14px;
	}

	.maintenance-content {
		height: 100%;
		overflow: auto;
	}
</style>
