import type { NodeId, FsNode } from './types';

export type OperationKind =
	| 'create_folder'
	| 'create_file'
	| 'create_alias'
	| 'move'
	| 'rename'
	| 'duplicate'
	| 'trash'
	| 'empty_trash';

export type UndoRecord = {
	kind: OperationKind;
	label: string;
	undoData: UndoData;
};

export type UndoData =
	| { type: 'delete_node'; nodeId: NodeId }
	| { type: 'delete_nodes'; nodeIds: NodeId[] }
	| { type: 'move_back'; nodeId: NodeId; previousParentId: NodeId }
	| { type: 'rename_back'; nodeId: NodeId; previousName: string }
	| { type: 'restore_nodes'; nodes: FsNode[] };
