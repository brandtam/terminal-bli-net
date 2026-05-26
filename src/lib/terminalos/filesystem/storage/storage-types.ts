import type { TerminalVolume, FsNode, BodyId, FsResult } from '../types';

export interface ManifestStore {
	load(): Promise<{ volume: TerminalVolume; nodes: FsNode[] } | null>;
	save(volume: TerminalVolume, nodes: FsNode[]): Promise<FsResult<void>>;
	clear(): Promise<void>;
}

export interface BodyStore {
	read(bodyId: BodyId): Promise<ArrayBuffer | null>;
	write(bodyId: BodyId, data: ArrayBuffer): Promise<FsResult<void>>;
	delete(bodyId: BodyId): Promise<void>;
	clear(): Promise<void>;
	getUsedBytes(): Promise<number>;
}

/** In-memory implementation for testing. */
export class InMemoryManifestStore implements ManifestStore {
	private data: { volume: TerminalVolume; nodes: FsNode[] } | null = null;

	async load() {
		return this.data;
	}
	async save(volume: TerminalVolume, nodes: FsNode[]) {
		this.data = { volume, nodes };
		return { ok: true as const, value: undefined };
	}
	async clear() {
		this.data = null;
	}
}

export class InMemoryBodyStore implements BodyStore {
	private bodies = new Map<BodyId, ArrayBuffer>();

	async read(bodyId: BodyId) {
		return this.bodies.get(bodyId) ?? null;
	}
	async write(bodyId: BodyId, data: ArrayBuffer) {
		this.bodies.set(bodyId, data);
		return { ok: true as const, value: undefined };
	}
	async delete(bodyId: BodyId) {
		this.bodies.delete(bodyId);
	}
	async clear() {
		this.bodies.clear();
	}
	async getUsedBytes() {
		let total = 0;
		for (const buf of this.bodies.values()) total += buf.byteLength;
		return total;
	}
}
