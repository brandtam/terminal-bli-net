import type { TerminalFS } from '../filesystem/terminal-fs';
import type { DiskUsage } from '../filesystem/usage';

export function createDiskUsageView(fs: TerminalFS) {
	let usage = $state<DiskUsage | null>(null);
	let loading = $state(true);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function load() {
		loading = true;
		const result = await fs.getDiskUsage();
		if (result.ok) {
			usage = result.value;
		}
		loading = false;
	}

	load();

	const unwatch = fs.watch(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			load();
		}, 1000);
	});

	function destroy() {
		if (debounceTimer) clearTimeout(debounceTimer);
		unwatch();
	}

	return {
		get usage() {
			return usage;
		},
		get loading() {
			return loading;
		},
		refresh: load,
		destroy
	};
}
