import type { TerminalFS } from '../filesystem/terminal-fs';
import type { DiskUsage } from '../filesystem/usage';

export function createDiskUsageView(fs: TerminalFS) {
	let usage = $state<DiskUsage | null>(null);
	let loading = $state(true);

	async function load() {
		loading = true;
		const result = await fs.getDiskUsage();
		if (result.ok) {
			usage = result.value;
		}
		loading = false;
	}

	load();

	// Refresh on any filesystem change
	const unwatch = fs.watch(() => {
		load();
	});

	function destroy() {
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
