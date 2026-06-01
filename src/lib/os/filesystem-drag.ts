import {
	fail,
	ok,
	type FsNode,
	type FsResult,
	type NodeId,
	type TerminalFS
} from '$lib/terminalos';

export const FILESYSTEM_NODE_DRAG_TYPE = 'application/x-terminal-fs-node';

let activeFilesystemDragNodeId: NodeId | null = null;

export type FilesystemDropTarget = { kind: 'folder'; folderId: NodeId } | { kind: 'trash' };

export function canDragFilesystemNode(node: FsNode): boolean {
	return node.flags?.protected !== true && node.flags?.system !== true;
}

export function writeFilesystemDragNode(dataTransfer: DataTransfer | null, node: FsNode): boolean {
	if (!dataTransfer || !canDragFilesystemNode(node)) return false;
	activeFilesystemDragNodeId = node.id;
	dataTransfer.effectAllowed = 'move';
	dataTransfer.setData(FILESYSTEM_NODE_DRAG_TYPE, node.id);
	dataTransfer.setData('text/plain', node.id);
	return true;
}

export function readFilesystemDragNodeId(dataTransfer: DataTransfer | null): NodeId | null {
	if (!dataTransfer) return activeFilesystemDragNodeId;
	return dataTransfer.getData(FILESYSTEM_NODE_DRAG_TYPE) || activeFilesystemDragNodeId;
}

export function clearFilesystemDragNode(): void {
	activeFilesystemDragNodeId = null;
}

export function canDropFilesystemNode(node: FsNode, target: FilesystemDropTarget): boolean {
	if (!canDragFilesystemNode(node)) return false;
	if (target.kind === 'trash') return true;
	if (node.parentId === target.folderId) return false;
	if (node.kind === 'folder' && node.id === target.folderId) return false;
	return true;
}

export async function performFilesystemDrop(
	fs: TerminalFS,
	nodeId: NodeId,
	target: FilesystemDropTarget
): Promise<FsResult<FsNode>> {
	const node = fs.peekNode(nodeId);
	if (!node) return fail('not_found', `Node "${nodeId}" not found`);

	if (target.kind === 'trash') {
		return fs.trash(nodeId);
	}

	if (node.parentId === target.folderId) {
		return ok(node);
	}

	return fs.move(nodeId, target.folderId);
}
