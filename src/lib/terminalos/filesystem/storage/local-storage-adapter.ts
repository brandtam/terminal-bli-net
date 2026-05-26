import type { ManifestStore } from './storage-types';
import type { TerminalVolume, FsNode, FsResult } from '../types';
import { fsNodeSchema, terminalVolumeSchema } from '../schemas';
import { ok, fail } from '../errors';
import { z } from 'zod';

const STORAGE_KEY = 'terminalos.manifest';

const manifestSchema = z.object({
	volume: terminalVolumeSchema,
	nodes: z.array(fsNodeSchema)
});

export class LocalStorageManifestStore implements ManifestStore {
	async load(): Promise<{ volume: TerminalVolume; nodes: FsNode[] } | null> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			const result = manifestSchema.safeParse(parsed);
			if (!result.success) return null;
			return result.data as { volume: TerminalVolume; nodes: FsNode[] };
		} catch {
			return null;
		}
	}

	async save(volume: TerminalVolume, nodes: FsNode[]): Promise<FsResult<void>> {
		try {
			const data = JSON.stringify({ volume, nodes });
			localStorage.setItem(STORAGE_KEY, data);
			return ok(undefined);
		} catch (e) {
			return fail('quota_exceeded', 'Failed to save manifest to localStorage', e);
		}
	}

	async clear(): Promise<void> {
		localStorage.removeItem(STORAGE_KEY);
	}
}
