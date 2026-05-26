import type { TerminalFS } from '../filesystem/terminal-fs';
import { getShopCatalog } from '../apps/software-shop';
import type { ShopItem } from '../apps/software-shop';

export function createAppLibraryView(fs: TerminalFS) {
	let catalog = $state<ShopItem[]>([]);
	let loading = $state(true);

	function load() {
		loading = true;
		catalog = getShopCatalog(fs.getAllNodes());
		loading = false;
	}

	load();

	// Refresh when apps are installed/uninstalled
	const unwatch = fs.watch((event) => {
		if (
			event.operation === 'install_app' ||
			event.operation === 'uninstall_app' ||
			event.operation === 'restore' ||
			event.operation === 'reinstall'
		) {
			load();
		}
	});

	function destroy() {
		unwatch();
	}

	return {
		get catalog() {
			return catalog;
		},
		get loading() {
			return loading;
		},
		refresh: load,
		destroy
	};
}
