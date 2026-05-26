import { describe, it, expect } from 'vitest';
import { validateNode, validateVolume } from './schemas';

const VOLUME_ID = 'vol_test';
const NOW = Date.now();

describe('validateNode', () => {
	it('validates a valid FsFolder', () => {
		const folder = {
			id: 'f1',
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: null,
			name: 'Root',
			createdAt: NOW,
			updatedAt: NOW
		};
		const result = validateNode(folder);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.kind).toBe('folder');
		}
	});

	it('validates a valid FsFile', () => {
		const file = {
			id: 'f2',
			volumeId: VOLUME_ID,
			kind: 'file',
			parentId: 'f1',
			name: 'test.txt',
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text: 'hello' },
			createdAt: NOW,
			updatedAt: NOW
		};
		const result = validateNode(file);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.kind).toBe('file');
		}
	});

	it('validates a valid FsAlias', () => {
		const alias = {
			id: 'a1',
			volumeId: VOLUME_ID,
			kind: 'alias',
			parentId: 'desktop',
			name: 'My App',
			target: {
				nodeId: 'f2',
				originalPath: 'Terminal HD/Applications/My App',
				originalName: 'My App',
				targetKind: 'app'
			},
			createdAt: NOW,
			updatedAt: NOW
		};
		const result = validateNode(alias);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.kind).toBe('alias');
		}
	});

	it('validates node with flags', () => {
		const folder = {
			id: 'f1',
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: null,
			name: 'Root',
			flags: { system: true, protected: true },
			createdAt: NOW,
			updatedAt: NOW
		};
		const result = validateNode(folder);
		expect(result.ok).toBe(true);
	});

	it('fails on invalid data', () => {
		const result = validateNode({ id: 'bad', kind: 'banana' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('corrupt_disk');
		}
	});

	it('fails on missing required fields', () => {
		const result = validateNode({ kind: 'folder' });
		expect(result.ok).toBe(false);
	});

	it('fails on non-object input', () => {
		const result = validateNode('not an object');
		expect(result.ok).toBe(false);
	});

	it('returns typed FsResult', () => {
		const folder = {
			id: 'f1',
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: null,
			name: 'Root',
			createdAt: NOW,
			updatedAt: NOW
		};
		const result = validateNode(folder);
		// Type narrowing works
		if (result.ok) {
			expect(result.value.id).toBe('f1');
		} else {
			expect(result.error.code).toBeDefined();
		}
	});
});

describe('validateVolume', () => {
	it('validates a valid volume', () => {
		const vol = {
			id: 'vol_1',
			name: 'Terminal HD',
			kind: 'local',
			rootNodeId: 'root'
		};
		const result = validateVolume(vol);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe('Terminal HD');
		}
	});

	it('fails on invalid volume', () => {
		const result = validateVolume({ id: 'vol_1', kind: 'remote' });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('corrupt_disk');
		}
	});
});
