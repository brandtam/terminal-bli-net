import { z } from 'zod';
import type { FsNode, FsResult, TerminalVolume } from './types';
import { ok, fail } from './errors';

// --- Shared schemas ---

const nodeFlagsSchema = z.object({
	system: z.boolean().optional(),
	protected: z.boolean().optional(),
	hidden: z.boolean().optional(),
	packageOwned: z.string().optional()
});

export const bodyRefSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('inline-text'),
		text: z.string()
	}),
	z.object({
		kind: z.literal('indexeddb-blob'),
		bodyId: z.string(),
		contentType: z.string().optional(),
		size: z.number()
	}),
	z.object({
		kind: z.literal('remote-blob'),
		provider: z.literal('r2'),
		key: z.string(),
		size: z.number(),
		sha256: z.string().optional()
	})
]);

const aliasTargetSchema = z.object({
	nodeId: z.string(),
	originalPath: z.string(),
	originalName: z.string(),
	targetKind: z.enum(['file', 'folder', 'app']),
	fingerprint: z.string().optional()
});

// --- Node schemas ---

const fsFolderSchema = z.object({
	id: z.string(),
	volumeId: z.string(),
	kind: z.literal('folder'),
	parentId: z.string().nullable(),
	name: z.string(),
	flags: nodeFlagsSchema.optional(),
	createdAt: z.number(),
	updatedAt: z.number()
});

const fileTypeSchema = z.enum(['text', 'sticky', 'recording', 'app', 'data', 'unknown']);

const fsFileSchema = z.object({
	id: z.string(),
	volumeId: z.string(),
	kind: z.literal('file'),
	parentId: z.string(),
	name: z.string(),
	fileType: fileTypeSchema,
	opensWith: z.string().optional(),
	appId: z.string().optional(),
	bodyRef: bodyRefSchema.optional(),
	flags: nodeFlagsSchema.optional(),
	createdAt: z.number(),
	updatedAt: z.number()
});

const fsAliasSchema = z.object({
	id: z.string(),
	volumeId: z.string(),
	kind: z.literal('alias'),
	parentId: z.string(),
	name: z.string(),
	target: aliasTargetSchema,
	flags: nodeFlagsSchema.optional(),
	createdAt: z.number(),
	updatedAt: z.number()
});

export const fsNodeSchema = z.discriminatedUnion('kind', [
	fsFolderSchema,
	fsFileSchema,
	fsAliasSchema
]);

export const terminalVolumeSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.literal('local'),
	rootNodeId: z.string(),
	ownedApps: z.array(z.string()).optional()
});

// --- Validation helpers ---

export function validateNode(data: unknown): FsResult<FsNode> {
	const result = fsNodeSchema.safeParse(data);
	if (result.success) {
		return ok(result.data as FsNode);
	}
	return fail('corrupt_disk', 'Invalid node data', result.error.format());
}

export function validateVolume(data: unknown): FsResult<TerminalVolume> {
	const result = terminalVolumeSchema.safeParse(data);
	if (result.success) {
		return ok(result.data as TerminalVolume);
	}
	return fail('corrupt_disk', 'Invalid volume data', result.error.format());
}
