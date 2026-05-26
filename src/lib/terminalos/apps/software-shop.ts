import type { AppId, FsFile, FsNode, NodeId } from '../filesystem/types';
import { getAppDef } from './app-library';
import { APP_LIBRARY } from './app-library';
import type { TerminalAppDefinition } from './app-types';

export type ShopItem = {
	app: TerminalAppDefinition;
	installed: boolean;
};

/** Apps that don't appear in the shop — they're the shell/system, not installable. */
const HIDDEN_FROM_SHOP = new Set<AppId>(['finder', 'trash', 'system-prefs', 'about-terminal']);

/**
 * Get the Software Shop catalog — all apps that should appear in the shop.
 * Excludes system-only apps that aren't meaningful to show (finder, trash).
 * Marks each as installed or not based on whether an app file exists.
 */
export function getShopCatalog(nodes: Map<NodeId, FsNode>): ShopItem[] {
	return APP_LIBRARY.filter((app) => !HIDDEN_FROM_SHOP.has(app.id)).map((app) => ({
		app,
		installed: isInstalled(app.id, nodes)
	}));
}

/**
 * Check if an app is currently installed (has an app file node in the filesystem).
 * Only matches fileType: 'app' — not user documents created by the app.
 */
export function isInstalled(appId: AppId, nodes: Map<NodeId, FsNode>): boolean {
	for (const node of nodes.values()) {
		if (node.kind === 'file' && node.fileType === 'app' && node.appId === appId) {
			return true;
		}
	}
	return false;
}

/**
 * Find the app file node for a given appId.
 * Only matches fileType: 'app' — not user documents created by the app.
 */
export function findAppFile(appId: AppId, nodes: Map<NodeId, FsNode>): FsFile | undefined {
	for (const node of nodes.values()) {
		if (node.kind === 'file' && node.fileType === 'app' && node.appId === appId) {
			return node;
		}
	}
	return undefined;
}

/**
 * Check whether an app can be uninstalled.
 */
export function canUninstall(appId: AppId): boolean {
	const def = getAppDef(appId);
	if (!def) return false;
	return def.removable;
}
