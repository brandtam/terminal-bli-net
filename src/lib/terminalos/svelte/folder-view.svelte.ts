import type { TerminalFS } from '../filesystem/terminal-fs';
import type { FsNode, NodeId } from '../filesystem/types';

export function createFolderView(fs: TerminalFS, folderId: NodeId) {
	let items = $state<FsNode[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		const result = await fs.listFolder(folderId);
		if (result.ok) {
			items = result.value;
		} else {
			error = result.error.message;
			items = [];
		}
		loading = false;
	}

	// Initial load
	load();

	// Watch for changes to this folder
	const unwatch = fs.watchFolder(folderId, () => {
		load();
	});

	function destroy() {
		unwatch();
	}

	return {
		get items() {
			return items;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		refresh: load,
		destroy
	};
}
