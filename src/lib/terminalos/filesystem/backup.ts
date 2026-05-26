import { z } from 'zod';
import type { FsNode, FsResult, NodeId, TerminalVolume } from './types';
import { fsNodeSchema } from './schemas';
import { ok, fail } from './errors';

// --- Backup format ---

export type BackupFile = {
	format: 'terminal-hd';
	version: 1;
	exportedAt: string;
	disk: {
		id: string;
		name: string;
	};
	nodes: FsNode[];
	bodies: Record<string, string>; // bodyId -> base64-encoded text (for inline text bodies in v1)
};

export type BackupPreview = {
	diskName: string;
	exportedAt: string;
	fileCount: number;
	folderCount: number;
	aliasCount: number;
	appCount: number;
	totalNodes: number;
};

// --- Zod schema for backup validation ---

const backupSchema = z.object({
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

// --- Export ---

/**
 * Build a backup from the current visible disk state.
 * Excludes: private app data, caches, operation history, undo state.
 */
export function buildBackup(volume: TerminalVolume, nodes: Map<NodeId, FsNode>): BackupFile {
	const visibleNodes: FsNode[] = [];
	const bodies: Record<string, string> = {};

	for (const node of nodes.values()) {
		// Skip hidden nodes
		if (node.flags?.hidden) continue;

		visibleNodes.push(node);

		// Collect inline text bodies
		if (node.kind === 'file' && node.bodyRef?.kind === 'inline-text') {
			bodies[node.id] = node.bodyRef.text;
		}
	}

	return {
		format: 'terminal-hd',
		version: 1,
		exportedAt: new Date().toISOString(),
		disk: {
			id: volume.id,
			name: volume.name
		},
		nodes: visibleNodes,
		bodies
	};
}

// --- Validate ---

/**
 * Validate a backup file's structure. Returns typed result.
 */
export function validateBackup(data: unknown): FsResult<BackupFile> {
	const result = backupSchema.safeParse(data);
	if (!result.success) {
		return fail('invalid_backup', 'Backup file is not valid', result.error.format());
	}
	return ok(result.data as BackupFile);
}

// --- Preview ---

/**
 * Generate a preview summary from a validated backup.
 */
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

	return {
		diskName: backup.disk.name,
		exportedAt: backup.exportedAt,
		fileCount,
		folderCount,
		aliasCount,
		appCount,
		totalNodes: backup.nodes.length
	};
}

// --- Validate for export ---

/**
 * Quick sanity check that the current disk is exportable.
 * Returns ok if the disk looks sane, fail if something is wrong.
 */
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
