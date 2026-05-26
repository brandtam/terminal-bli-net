import type { NodeId } from './types';

export type FsChangeEvent = {
	/** IDs of nodes that were directly changed (created, modified, deleted). */
	changedNodeIds: NodeId[];
	/** IDs of folders whose children changed (parent of created/moved/deleted nodes). */
	changedFolderIds: NodeId[];
	/** The operation that caused the change. */
	operation: string;
	/** Whether this change came from another tab via BroadcastChannel. */
	remote: boolean;
};

export type FsWatchCallback = (event: FsChangeEvent) => void;

type WatchEntry =
	| { kind: 'global'; callback: FsWatchCallback }
	| { kind: 'node'; nodeId: NodeId; callback: FsWatchCallback }
	| { kind: 'folder'; folderId: NodeId; callback: FsWatchCallback };

export class WatcherRegistry {
	private watchers: WatchEntry[] = [];

	/** Watch all filesystem changes. Returns unsubscribe function. */
	watch(callback: FsWatchCallback): () => void {
		const entry: WatchEntry = { kind: 'global', callback };
		this.watchers.push(entry);
		return () => {
			this.watchers = this.watchers.filter((w) => w !== entry);
		};
	}

	/** Watch changes to a specific node. Returns unsubscribe function. */
	watchNode(nodeId: NodeId, callback: FsWatchCallback): () => void {
		const entry: WatchEntry = { kind: 'node', nodeId, callback };
		this.watchers.push(entry);
		return () => {
			this.watchers = this.watchers.filter((w) => w !== entry);
		};
	}

	/** Watch changes to a folder's children. Returns unsubscribe function. */
	watchFolder(folderId: NodeId, callback: FsWatchCallback): () => void {
		const entry: WatchEntry = { kind: 'folder', folderId, callback };
		this.watchers.push(entry);
		return () => {
			this.watchers = this.watchers.filter((w) => w !== entry);
		};
	}

	/** Notify all relevant watchers of a change event. */
	notify(event: FsChangeEvent): void {
		for (const w of this.watchers) {
			if (w.kind === 'global') {
				w.callback(event);
			} else if (w.kind === 'node') {
				if (event.changedNodeIds.includes(w.nodeId)) {
					w.callback(event);
				}
			} else if (w.kind === 'folder') {
				if (event.changedFolderIds.includes(w.folderId)) {
					w.callback(event);
				}
			}
		}
	}

	/** Remove all watchers. */
	clear(): void {
		this.watchers = [];
	}
}
