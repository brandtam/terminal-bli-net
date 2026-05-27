import { z } from 'zod';
import type { FsNode, FsResult, NodeId, TerminalVolume } from './types';
import { fsNodeSchema } from './schemas';
import { ok, fail } from './errors';
import type { TweaksState, Conversation, WindowState } from '$lib/types';

/*
 * BACKUP COVERAGE REGISTRY
 *
 * Every persistent state key must appear here. When adding new persisted
 * state, add an entry — scripts/lint-backup-coverage.js enforces this.
 *
 * Key                                  | Backed up | Reason if excluded
 * ------------------------------------ | --------- | ---------------------------
 * terminalos.manifest (nodes+volume)   | Yes       | Core disk data
 * terminal.os.tweaks                   | Yes (v2)  | User preferences
 * terminal.app.chatrbot.conversations  | Yes (v2)  | Chat history
 * terminal.os.timezone                 | Yes (v2)  | User preference
 * terminal.os.windows                  | Yes (v2)  | Window layout
 * terminal.os.session                  | No        | Per-session unique ID
 * terminal.os.firstVisit               | No        | Should reset on new device
 */

// --- Backup preferences ---

export type BackupPreferences = {
	tweaks?: TweaksState;
	conversations?: Record<string, Conversation>;
	timezone?: string | null;
	windows?: WindowState[];
};

const backupPreferencesSchema = z
	.object({
		tweaks: z
			.object({
				wallpaper: z.string(),
				accent: z.string(),
				tvGridLoop: z.number(),
				marqueeLoop: z.number(),
				tvPauseOnHover: z.boolean()
			})
			.optional(),
		conversations: z
			.record(
				z.object({
					botId: z.string(),
					group: z.string(),
					messages: z.array(
						z.object({
							role: z.enum(['user', 'assistant']),
							content: z.string()
						})
					),
					updatedAt: z.number()
				})
			)
			.optional(),
		timezone: z.string().nullable().optional(),
		windows: z
			.array(
				z.object({
					id: z.string(),
					x: z.number(),
					y: z.number(),
					w: z.number(),
					h: z.number(),
					z: z.number()
				})
			)
			.optional()
	})
	.optional();

// --- Backup format ---

export type BackupFileV1 = {
	format: 'terminal-hd';
	version: 1;
	exportedAt: string;
	disk: {
		id: string;
		name: string;
	};
	nodes: FsNode[];
	bodies: Record<string, string>;
};

export type BackupFileV2 = {
	format: 'terminal-hd';
	version: 2;
	exportedAt: string;
	disk: {
		id: string;
		name: string;
		ownedApps?: string[];
	};
	nodes: FsNode[];
	bodies: Record<string, string>;
	preferences?: BackupPreferences;
};

export type BackupFile = BackupFileV1 | BackupFileV2;

export type BackupPreview = {
	diskName: string;
	exportedAt: string;
	fileCount: number;
	folderCount: number;
	aliasCount: number;
	appCount: number;
	totalNodes: number;
	hasPreferences: boolean;
};

export type BackupRestoreResult = BackupPreview & {
	preferences?: BackupPreferences;
};

// --- Zod schemas ---

const backupSchemaV1 = z.object({
	format: z.literal('terminal-hd'),
	version: z.literal(1),
	exportedAt: z.string(),
	disk: z.object({
		id: z.string(),
		name: z.string()
	}),
	nodes: z.array(fsNodeSchema),
	bodies: z.record(z.string())
});

const backupSchemaV2 = z.object({
	format: z.literal('terminal-hd'),
	version: z.literal(2),
	exportedAt: z.string(),
	disk: z.object({
		id: z.string(),
		name: z.string(),
		ownedApps: z.array(z.string()).optional()
	}),
	nodes: z.array(fsNodeSchema),
	bodies: z.record(z.string()),
	preferences: backupPreferencesSchema
});

const backupSchema = z.discriminatedUnion('version', [backupSchemaV1, backupSchemaV2]);

// --- Export ---

export function buildBackup(
	volume: TerminalVolume,
	nodes: Map<NodeId, FsNode>,
	preferences?: BackupPreferences
): BackupFileV2 {
	const visibleNodes: FsNode[] = [];
	const bodies: Record<string, string> = {};

	for (const node of nodes.values()) {
		if (node.flags?.hidden) continue;

		visibleNodes.push(node);

		if (node.kind === 'file' && node.bodyRef?.kind === 'inline-text') {
			bodies[node.id] = node.bodyRef.text;
		}
	}

	return {
		format: 'terminal-hd',
		version: 2,
		exportedAt: new Date().toISOString(),
		disk: {
			id: volume.id,
			name: volume.name,
			ownedApps: volume.ownedApps
		},
		nodes: visibleNodes,
		bodies,
		preferences
	};
}

// --- Validate ---

export function validateBackup(data: unknown): FsResult<BackupFile> {
	const result = backupSchema.safeParse(data);
	if (!result.success) {
		return fail('invalid_backup', 'Backup file is not valid', result.error.format());
	}
	return ok(result.data as BackupFile);
}

// --- Preview ---

export function previewBackup(backup: BackupFile): BackupPreview {
	let fileCount = 0;
	let folderCount = 0;
	let aliasCount = 0;
	let appCount = 0;

	for (const node of backup.nodes) {
		if (node.kind === 'file') {
			fileCount++;
			if (node.fileType === 'app') appCount++;
		} else if (node.kind === 'folder') {
			folderCount++;
		} else {
			aliasCount++;
		}
	}

	const hasPreferences =
		backup.version === 2 &&
		backup.preferences != null &&
		Object.keys(backup.preferences).length > 0;

	return {
		diskName: backup.disk.name,
		exportedAt: backup.exportedAt,
		fileCount,
		folderCount,
		aliasCount,
		appCount,
		totalNodes: backup.nodes.length,
		hasPreferences
	};
}

// --- Validate for export ---

export function validateDiskForExport(
	volume: TerminalVolume,
	nodes: Map<NodeId, FsNode>
): FsResult<void> {
	if (!volume.id || !volume.name) {
		return fail('corrupt_disk', 'Volume metadata is missing');
	}
	if (!nodes.has(volume.rootNodeId)) {
		return fail('corrupt_disk', 'Root node is missing');
	}
	if (nodes.size === 0) {
		return fail('corrupt_disk', 'Disk has no nodes');
	}
	return ok(undefined);
}
