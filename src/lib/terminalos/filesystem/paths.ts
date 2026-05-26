import type { NodeId, FsNode } from './types';

/**
 * Walk the parentId chain to build a path like "Terminal HD/Documents/README.TXT".
 * The root node's name serves as the volume label at the start of the path.
 */
export function derivePath(nodeId: NodeId, nodes: Map<NodeId, FsNode>): string {
	const parts: string[] = [];
	let current = nodes.get(nodeId);

	while (current) {
		parts.unshift(current.name);
		current = current.parentId ? nodes.get(current.parentId) : undefined;
	}

	return parts.join('/');
}
