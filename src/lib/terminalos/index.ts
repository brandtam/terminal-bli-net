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
export type { AliasResolution } from './filesystem/aliases';
export type { OperationKind, UndoRecord } from './filesystem/operations';
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
