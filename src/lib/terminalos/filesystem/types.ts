export type VolumeId = string;
export type NodeId = string;
export type BodyId = string;
export type AppId = string;

export type InstalledApp = {
	id: AppId;
	name: string;
	icon: string;
	windowId: string;
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

export type TerminalVolume = {
	id: VolumeId;
	name: string;
	kind: 'local';
	rootNodeId: NodeId;
	ownedApps?: AppId[];
};

export type NodeFlags = {
	system?: boolean;
	protected?: boolean;
	hidden?: boolean;
	packageOwned?: AppId;
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
	opensWith?: AppId;
	appId?: AppId;
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
