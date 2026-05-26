import type { NodeId, FsNode, FsAlias } from './types';
import { derivePath } from './paths';

export type AliasResolution =
	| { status: 'resolved'; node: FsNode }
	| { status: 'repaired'; node: FsNode; alias: FsAlias }
	| { status: 'broken'; alias: FsAlias; reason: string };

/**
 * Resolve an alias to its target node.
 *
 * Resolution order:
 * 1. Look up target by nodeId (stable ID) — if found, resolved.
 * 2. If not found, attempt repair using clues.
 * 3. If repair finds exactly one confident match, repair and return 'repaired'.
 * 4. If no match or multiple matches, return 'broken'.
 */
export function resolveAlias(alias: FsAlias, nodes: Map<NodeId, FsNode>): AliasResolution {
	// Step 1: Direct lookup by stable ID
	const directTarget = nodes.get(alias.target.nodeId);
	if (directTarget) {
		return { status: 'resolved', node: directTarget };
	}

	// Step 2: Attempt repair
	const candidates = findRepairCandidates(alias, nodes);

	if (candidates.length === 1) {
		const repairedTarget = candidates[0];
		const repairedAlias: FsAlias = {
			...alias,
			target: {
				...alias.target,
				nodeId: repairedTarget.id,
				originalPath: derivePath(repairedTarget.id, nodes),
				originalName: repairedTarget.name
			},
			updatedAt: Date.now()
		};
		return { status: 'repaired', node: repairedTarget, alias: repairedAlias };
	}

	// Step 3: Broken
	const reason =
		candidates.length === 0
			? 'Target not found and no repair candidates'
			: `Multiple repair candidates found (${candidates.length})`;
	return { status: 'broken', alias, reason };
}

/**
 * Find nodes that might be the original target of a broken alias.
 *
 * Matching criteria (ALL must match for a candidate):
 * - Same targetKind (file/folder/app)
 * - Same name as originalName (case-insensitive)
 * - If fingerprint exists on the alias target, candidate must match it
 *
 * A fingerprint for app aliases is the appId.
 * A fingerprint for file aliases is the fileType.
 */
export function findRepairCandidates(alias: FsAlias, nodes: Map<NodeId, FsNode>): FsNode[] {
	const target = alias.target;
	const candidates: FsNode[] = [];

	for (const node of nodes.values()) {
		// Skip the alias itself
		if (node.id === alias.id) continue;

		// Must match targetKind
		if (target.targetKind === 'app') {
			if (node.kind !== 'file' || node.fileType !== 'app') continue;
		} else if (target.targetKind === 'file') {
			if (node.kind !== 'file') continue;
		} else if (target.targetKind === 'folder') {
			if (node.kind !== 'folder') continue;
		}

		// Must match name (case-insensitive)
		if (node.name.toLowerCase() !== target.originalName.toLowerCase()) continue;

		// If fingerprint exists, must match
		if (target.fingerprint) {
			if (node.kind === 'file' && node.appId && target.fingerprint === node.appId) {
				candidates.push(node);
			} else if (node.kind === 'file' && node.fileType && target.fingerprint === node.fileType) {
				candidates.push(node);
			}
			// If fingerprint doesn't match, skip this candidate
			continue;
		}

		candidates.push(node);
	}

	return candidates;
}

/**
 * Build a fingerprint for a node, used when creating aliases.
 * For app files: the appId
 * For other files: the fileType
 * For folders: undefined
 */
export function buildFingerprint(node: FsNode): string | undefined {
	if (node.kind === 'file') {
		if (node.fileType === 'app' && node.appId) return node.appId;
		return node.fileType;
	}
	return undefined;
}
