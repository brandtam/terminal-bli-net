import { describe, it, expect } from 'vitest';
import { derivePath } from './paths';
import type { FsNode, FsFolder, FsFile } from './types';

const VOLUME_ID = 'vol_test';

function makeFolder(id: string, name: string, parentId: string | null): FsFolder {
	return {
		id,
		volumeId: VOLUME_ID,
		kind: 'folder',
		parentId,
		name,
		createdAt: 0,
		updatedAt: 0
	};
}

function makeFile(id: string, name: string, parentId: string): FsFile {
	return {
		id,
		volumeId: VOLUME_ID,
		kind: 'file',
		parentId,
		name,
		fileType: 'text',
		createdAt: 0,
		updatedAt: 0
	};
}

describe('derivePath', () => {
	it('returns just the volume name for the root node', () => {
		const nodes = new Map<string, FsNode>();
		nodes.set('root', makeFolder('root', 'Terminal HD', null));

		expect(derivePath('root', nodes)).toBe('Terminal HD');
	});

	it('returns full path for a nested node', () => {
		const nodes = new Map<string, FsNode>();
		nodes.set('root', makeFolder('root', 'Terminal HD', null));
		nodes.set('docs', makeFolder('docs', 'Documents', 'root'));
		nodes.set('readme', makeFile('readme', 'README.TXT', 'docs'));

		expect(derivePath('readme', nodes)).toBe('Terminal HD/Documents/README.TXT');
	});

	it('returns folder path for intermediate node', () => {
		const nodes = new Map<string, FsNode>();
		nodes.set('root', makeFolder('root', 'Terminal HD', null));
		nodes.set('docs', makeFolder('docs', 'Documents', 'root'));

		expect(derivePath('docs', nodes)).toBe('Terminal HD/Documents');
	});
});
