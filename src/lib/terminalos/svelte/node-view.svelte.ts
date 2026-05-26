import type { TerminalFS } from '../filesystem/terminal-fs';
import type { FsNode, NodeId } from '../filesystem/types';

export function createNodeView(fs: TerminalFS, nodeId: NodeId) {
	let node = $state<FsNode | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		const result = await fs.getNode(nodeId);
		if (result.ok) {
			node = result.value;
		} else {
			error = result.error.message;
			node = null;
		}
		loading = false;
	}

	load();

	const unwatch = fs.watchNode(nodeId, () => {
		load();
	});

	function destroy() {
		unwatch();
	}

	return {
		get node() {
			return node;
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
