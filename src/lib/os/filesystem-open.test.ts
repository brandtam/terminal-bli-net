import { describe, expect, it, vi } from 'vitest';
import type { FsAlias, FsFile, FsFolder } from '$lib/terminalos';
import { openFilesystemNode } from './filesystem-open';

function file(overrides: Partial<FsFile> = {}): FsFile {
	return {
		id: 'file_1',
		volumeId: 'volume_terminal_hd',
		kind: 'file',
		parentId: 'folder_documents',
		name: 'Clip.webm',
		fileType: 'recording',
		createdAt: 1,
		updatedAt: 1,
		...overrides
	};
}

function folder(overrides: Partial<FsFolder> = {}): FsFolder {
	return {
		id: 'folder_1',
		volumeId: 'volume_terminal_hd',
		kind: 'folder',
		parentId: 'folder_documents',
		name: 'Projects',
		createdAt: 1,
		updatedAt: 1,
		...overrides
	};
}

function alias(targetNodeId: string, overrides: Partial<FsAlias> = {}): FsAlias {
	return {
		id: 'alias_1',
		volumeId: 'volume_terminal_hd',
		kind: 'alias',
		parentId: 'folder_desktop',
		name: 'Clip alias',
		target: {
			nodeId: targetNodeId,
			originalPath: '/Recordings/Clip.webm',
			originalName: 'Clip.webm',
			targetKind: 'file'
		},
		createdAt: 1,
		updatedAt: 1,
		...overrides
	};
}

function router() {
	return {
		resolveAlias: vi.fn(),
		openFolder: vi.fn(),
		launchApp: vi.fn(),
		openDocument: vi.fn()
	};
}

describe('openFilesystemNode', () => {
	it('opens a recording through document routing instead of launching its creator app', () => {
		const recording = file({
			appId: 'recorder',
			opensWith: 'player',
			bodyRef: {
				kind: 'indexeddb-blob',
				bodyId: 'body_1',
				size: 10,
				contentType: 'video/webm'
			}
		});
		const r = router();

		openFilesystemNode(recording, r);

		expect(r.openDocument).toHaveBeenCalledWith(recording);
		expect(r.launchApp).not.toHaveBeenCalled();
		expect(r.openFolder).not.toHaveBeenCalled();
	});

	it('opens a desktop document alias through the same document route as its target', () => {
		const recording = file({ id: 'rec_1', appId: 'recorder', opensWith: 'player' });
		const recordingAlias = alias(recording.id);
		const r = router();
		r.resolveAlias.mockReturnValue(recording);

		openFilesystemNode(recordingAlias, r);

		expect(r.resolveAlias).toHaveBeenCalledWith(recordingAlias);
		expect(r.openDocument).toHaveBeenCalledWith(recording);
		expect(r.launchApp).not.toHaveBeenCalled();
	});

	it('opens a generic content-type blob through document routing even without a creator app', () => {
		const video = file({
			id: 'video_1',
			appId: undefined,
			opensWith: undefined,
			fileType: 'data',
			bodyRef: {
				kind: 'indexeddb-blob',
				bodyId: 'body_video',
				size: 10,
				contentType: 'video/mp4'
			}
		});
		const r = router();

		openFilesystemNode(video, r);

		expect(r.openDocument).toHaveBeenCalledWith(video);
		expect(r.launchApp).not.toHaveBeenCalled();
	});

	it('launches app files as apps', () => {
		const appFile = file({
			id: 'app_textedit',
			name: 'TextEdit.app',
			fileType: 'app',
			appId: 'textedit'
		});
		const r = router();

		openFilesystemNode(appFile, r);

		expect(r.launchApp).toHaveBeenCalledWith('textedit');
		expect(r.openDocument).not.toHaveBeenCalled();
	});

	it('delegates folders to the caller-specific folder behavior', () => {
		const projects = folder();
		const r = router();

		openFilesystemNode(projects, r);

		expect(r.openFolder).toHaveBeenCalledWith(projects);
		expect(r.openDocument).not.toHaveBeenCalled();
		expect(r.launchApp).not.toHaveBeenCalled();
	});
});
