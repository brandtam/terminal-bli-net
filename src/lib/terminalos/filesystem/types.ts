export type VolumeId = string;
export type NodeId = string;
export type BodyId = string;

/**
 * The id types live in a leaf module (apps/app-ids.ts) that derives the closed
 * `AppId` union from the manifests. The filesystem keeps owning the public type
 * names by re-exporting them here. These are type-only re-exports — no runtime
 * import edge from the filesystem into apps/, and the leaf reaches nothing back
 * here, so there is no cycle.
 *
 * Use AppId for catalog-known ids (install/ownership/store). Use PersistedAppId
 * for anything read off a disk: an old disk may hold a renamed or removed id, so
 * that boundary must stay open.
 */
import type { AppId, PersistedAppId } from '../apps/app-ids';
export type { AppId, PersistedAppId };

export type InstalledApp = {
	// Built from a persisted node's appId — the disk may name an unknown app.
	id: PersistedAppId;
	name: string;
	icon: string;
	windowId?: string;
};

export type FsResult<T> = { ok: true; value: T } | { ok: false; error: FsError };

export type FsErrorCode =
	| 'not_found'
	| 'not_folder'
	| 'duplicate_name'
	| 'protected_node'
	| 'invalid_move'
	| 'broken_alias'
	| 'missing_app'
	| 'quota_exceeded'
	| 'disk_busy'
	| 'corrupt_disk'
	| 'invalid_backup';

export type FsError = {
	code: FsErrorCode;
	message: string;
	details?: unknown;
};

export type BodyGcReport = {
	stored: number;
	reachable: number;
	unreachable: number;
	deleted: number;
	failed: number;
	failedBodyIds: BodyId[];
};

export type TerminalVolume = {
	id: VolumeId;
	name: string;
	kind: 'local';
	rootNodeId: NodeId;
	// Persisted to disk → stays open. Narrow to AppId only when handing an id to
	// catalog logic after a successful lookup.
	ownedApps?: PersistedAppId[];
};

export type NodeFlags = {
	system?: boolean;
	protected?: boolean;
	hidden?: boolean;
	// Persisted on disk → open.
	packageOwned?: PersistedAppId;
};

export type FsFolder = {
	id: NodeId;
	volumeId: VolumeId;
	kind: 'folder';
	parentId: NodeId | null;
	name: string;
	flags?: NodeFlags;
	createdAt: number;
	updatedAt: number;
};

export type FileType = 'text' | 'sticky' | 'recording' | 'app' | 'data' | 'unknown';

export type BodyRef =
	| { kind: 'inline-text'; text: string }
	| { kind: 'indexeddb-blob'; bodyId: BodyId; contentType?: string; size: number }
	| { kind: 'remote-blob'; provider: 'r2'; key: string; size: number; sha256?: string };

export type FsFile = {
	id: NodeId;
	volumeId: VolumeId;
	kind: 'file';
	parentId: NodeId;
	name: string;
	fileType: FileType;
	// These come off disk → open. An old disk may name an unknown app.
	opensWith?: PersistedAppId;
	appId?: PersistedAppId;
	bodyRef?: BodyRef;
	flags?: NodeFlags;
	createdAt: number;
	updatedAt: number;
};

export type AliasTarget = {
	nodeId: NodeId;
	originalPath: string;
	originalName: string;
	targetKind: 'file' | 'folder' | 'app';
	fingerprint?: string;
};

export type FsAlias = {
	id: NodeId;
	volumeId: VolumeId;
	kind: 'alias';
	parentId: NodeId;
	name: string;
	target: AliasTarget;
	flags?: NodeFlags;
	createdAt: number;
	updatedAt: number;
};

export type FsNode = FsFolder | FsFile | FsAlias;
