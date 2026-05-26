export {
	TerminalFS,
	ROOT_ID,
	APPLICATIONS_ID,
	DOCUMENTS_ID,
	DESKTOP_ID,
	SYSTEM_ID,
	RECORDINGS_ID,
	TRASH_ID
} from './filesystem/terminal-fs';
export type {
	FsNode,
	FsFolder,
	FsFile,
	FsAlias,
	FsResult,
	FsError,
	FsErrorCode,
	NodeId,
	VolumeId,
	BodyId,
	AppId,
	TerminalVolume,
	FileType,
	BodyRef,
	AliasTarget,
	NodeFlags
} from './filesystem/types';
export { ok, fail, fsErr } from './filesystem/errors';
export {
	buildBackup,
	validateBackup,
	previewBackup,
	validateDiskForExport
} from './filesystem/backup';
export type { BackupFile, BackupPreview } from './filesystem/backup';
export type { AliasResolution } from './filesystem/aliases';
export type { OperationKind, UndoRecord } from './filesystem/operations';
export type { DiskUsage } from './filesystem/usage';
export type { FsChangeEvent, FsWatchCallback } from './filesystem/watchers';
export { WriteLock, InMemoryWriteLock } from './filesystem/lock';
export type { ManifestStore, BodyStore } from './filesystem/storage/storage-types';
export { InMemoryManifestStore, InMemoryBodyStore } from './filesystem/storage/storage-types';
export { LocalStorageManifestStore } from './filesystem/storage/local-storage-adapter';
export { IndexedDBBodyStore } from './filesystem/storage/indexeddb-adapter';
export {
	APP_LIBRARY,
	getAppDef,
	getDefaultInstalledApps,
	getDesktopAliasApps
} from './apps/app-library';
export type { TerminalAppDefinition, AppCategory } from './apps/app-types';
export {
	getAppWindowId,
	getAppIconKind,
	isAppInstalled,
	isSpecialLaunchApp
} from './apps/app-install';
export type { SpecialLaunchApp } from './apps/app-install';
export { getShopCatalog, isInstalled, canUninstall, findAppFile } from './apps/software-shop';
export type { ShopItem } from './apps/software-shop';
export { createFolderView } from './svelte/folder-view.svelte';
export { createNodeView } from './svelte/node-view.svelte';
export { createDiskUsageView } from './svelte/disk-usage-view.svelte';
export { createAppLibraryView } from './svelte/app-library-view.svelte';
