import type { AppId, FsFile, FsNode, NodeId } from '../filesystem/types';
import { getAppDef } from './app-library';
import { APP_LIBRARY } from './app-library';
import type { TerminalAppDefinition } from './app-types';

export type ShopItem = {
	app: TerminalAppDefinition;
	installed: boolean;
};

/**
 * Get the Software Shop catalog — all apps that should appear in the shop.
 * Store apps only (not system chrome), and deprecated apps are hidden.
 * Marks each as installed or not based on whether an app file exists.
 */
export function getShopCatalog(nodes: Map<NodeId, FsNode>): ShopItem[] {
	return APP_LIBRARY.filter((app) => !app.isSystem && app.status !== 'deprecated').map((app) => ({
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

/**
 * Check if an app is owned (on the user's shelf).
 * System apps are always owned. Store apps check the ownedApps list.
 */
export function isOwned(appId: AppId, ownedApps: AppId[]): boolean {
	const def = getAppDef(appId);
	if (!def) return false;
	if (def.isSystem) return true;
	return ownedApps.includes(appId);
}

/**
 * Get all owned app IDs — store apps that have been purchased.
 */
export function getOwnedAppIds(ownedApps: AppId[]): AppId[] {
	return [...ownedApps];
}

/**
 * Derive ownedApps from currently installed apps for migration.
 * Called once when loading a disk that lacks ownedApps (pre-ownership model).
 * Any installed store app gets added to ownedApps; free apps are always owned.
 */
export function deriveOwnedApps(nodes: Map<NodeId, FsNode>): AppId[] {
	const owned: AppId[] = [];
	for (const app of APP_LIBRARY) {
		if (!app.isSystem && isInstalled(app.id, nodes)) {
			owned.push(app.id);
		}
	}
	return owned;
}
