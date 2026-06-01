import type { FsAlias, FsFile, FsFolder, FsNode } from '$lib/terminalos';

export type FilesystemOpenRouter = {
	resolveAlias: (alias: FsAlias) => FsNode | null;
	openFolder: (folder: FsFolder) => void;
	launchApp: (appId: string) => void;
	openDocument: (file: FsFile) => void;
};

/**
 * Shared Finder/Desktop open policy. Callers still decide how folders behave
 * in their context, but app files launch apps and every non-app file enters
 * LaunchServices through os.openDocument.
 */
export function openFilesystemNode(
	node: FsNode,
	router: FilesystemOpenRouter,
	seen = new Set<string>()
): void {
	if (node.kind === 'alias') {
		if (seen.has(node.id)) return;
		seen.add(node.id);
		const target = router.resolveAlias(node);
		if (target) openFilesystemNode(target, router, seen);
		return;
	}

	if (node.kind === 'folder') {
		router.openFolder(node);
		return;
	}

	if (node.fileType === 'app' && node.appId) {
		router.launchApp(node.appId);
		return;
	}

	router.openDocument(node);
}
