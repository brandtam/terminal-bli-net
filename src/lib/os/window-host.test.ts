import { describe, it, expect } from 'vitest';
import type { FsFile } from '$lib/terminalos';
import { resolveOpenTarget } from './window-host';
import { matchWindow } from '$lib/terminalos/apps/app-catalog';

function mkFile(partial: Partial<FsFile>): FsFile {
	return {
		id: 'node1',
		volumeId: 'vol1',
		kind: 'file',
		parentId: 'parent1',
		name: 'Clip.webm',
		fileType: 'data',
		createdAt: 0,
		updatedAt: 0,
		...partial
	};
}

describe('matchWindow', () => {
	it('parses a player: instance id into its owning app, spec, and args', () => {
		const m = matchWindow('player:abc-123');
		expect(m?.appId).toBe('player');
		// The fileId tail is kept verbatim — including the '-' that file ids
		// contain, which the ':' separator (not '-') makes unambiguous.
		expect(m?.args.fileId).toBe('abc-123');
	});

	it('parses a chat: instance id into its owning app, spec, and args', () => {
		const m = matchWindow('chat:seinfeld');
		expect(m?.appId).toBe('chatrbot');
		expect(m?.args.slug).toBe('seinfeld');
	});

	it('keeps a multi-word slug intact — the : separator survives dashes', () => {
		// Show slugs contain '-' (breaking-bad); the chat:<slug> separator is ':'
		// precisely so the tail parses unambiguously.
		const m = matchWindow('chat:breaking-bad');
		expect(m?.appId).toBe('chatrbot');
		expect(m?.args.slug).toBe('breaking-bad');
	});

	it('returns null for ids no manifest claims via windows[]', () => {
		expect(matchWindow('textedit-xyz')).toBeNull();
		expect(matchWindow('definitely-unknown')).toBeNull();
		// The legacy chat- separator is no longer a flat window (it routes only
		// via the deprecated idPrefix until Slice 7), so matchWindow ignores it.
		expect(matchWindow('chat-seinfeld')).toBeNull();
	});
});

describe('resolveOpenTarget', () => {
	it('routes a recording to the Player via opensWith (the bug_002 path)', () => {
		const file = mkFile({
			id: 'rec1',
			appId: 'recorder',
			opensWith: 'player',
			fileType: 'recording',
			bodyRef: { kind: 'indexeddb-blob', bodyId: 'body1', size: 10, contentType: 'video/webm' }
		});
		expect(resolveOpenTarget(file)).toBe('player:rec1');
	});

	it('routes any video by content-type when opensWith is absent', () => {
		const file = mkFile({
			id: 'vid2',
			bodyRef: { kind: 'indexeddb-blob', bodyId: 'body2', size: 10, contentType: 'video/mp4' }
		});
		expect(resolveOpenTarget(file)).toBe('player:vid2');
	});

	it('routes by fileType when neither opensWith nor content-type matches', () => {
		const file = mkFile({ id: 'rec3', fileType: 'recording' });
		expect(resolveOpenTarget(file)).toBe('player:rec3');
	});

	it('falls back to the file id when nothing claims it', () => {
		const file = mkFile({ id: 'misc4' });
		expect(resolveOpenTarget(file)).toBe('misc4');
	});
});
