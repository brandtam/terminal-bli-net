import type { NodeId, FsNode } from './types';

export type DiskUsage = {
	nodeCount: number;
	fileCount: number;
	folderCount: number;
	aliasCount: number;
	inlineTextBytes: number;
	blobBytes: number;
	totalEstimatedBytes: number;
};

export function computeDiskUsage(nodes: Map<NodeId, FsNode>, blobBytes: number): DiskUsage {
	let fileCount = 0;
	let folderCount = 0;
	let aliasCount = 0;
	let inlineTextBytes = 0;

	for (const node of nodes.values()) {
		if (node.kind === 'file') {
			fileCount++;
			if (node.bodyRef?.kind === 'inline-text') {
				inlineTextBytes += new TextEncoder().encode(node.bodyRef.text).byteLength;
			}
		} else if (node.kind === 'folder') {
			folderCount++;
		} else {
			aliasCount++;
		}
	}

	return {
		nodeCount: nodes.size,
		fileCount,
		folderCount,
		aliasCount,
		inlineTextBytes,
		blobBytes,
		totalEstimatedBytes: inlineTextBytes + blobBytes
	};
}
