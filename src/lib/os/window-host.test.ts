import { describe, it, expect } from 'vitest';
import type { FsFile } from '$lib/terminalos';
import { resolveOpenTarget } from './window-host';
import { matchWindow } from '$lib/terminalos/apps/app-catalog';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';
import VCRWindowGeneric from '$lib/apps/vcr/VCRWindow.svelte';
import VCRWindowAG500R from '$lib/apps/vcr/VCRWindowAG500R.svelte';

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

	it('parses a textedit: instance id into its owning app, spec, and fileId arg', () => {
		const m = matchWindow('textedit:doc-7');
		expect(m?.appId).toBe('textedit');
		// File-ids contain '-'; the ':' separator keeps the tail unambiguous.
		expect(m?.args.fileId).toBe('doc-7');
	});

	it('returns null for ids no manifest claims via windows[]', () => {
		expect(matchWindow('definitely-unknown')).toBeNull();
		// Legacy `-` separators (textedit-, chat-) are no longer flat windows — the
		// live forms are textedit:/chat:. matchWindow ignores the old ids, so a stale
		// saved layout using them is dropped on restore.
		expect(matchWindow('textedit-xyz')).toBeNull();
		expect(matchWindow('chat-seinfeld')).toBeNull();
	});

	it('claims the system chrome dialogs for the system app (Slice 5)', () => {
		// welcome / about / terminal-prefs are exact-id windows on the system app;
		// they used to render through bespoke Desktop arms and now resolve here.
		for (const id of ['welcome', 'about', 'terminal-prefs']) {
			expect(matchWindow(id)?.appId, id).toBe('system');
		}
	});

	it('claims the fixed store-shell windows once migrated (Slice 6)', () => {
		// software-shop and computer-store are exact-id windows resolved through the
		// matcher now, not the legacy Desktop arms.
		expect(matchWindow('software-shop')?.appId).toBe('software-shop');
		expect(matchWindow('computer-store')?.appId).toBe('computer-store');
	});

	it('claims the main vcr window for the vcr app (Slice 6)', () => {
		// The main VCR window is an exact-id flat window now (its prefs dialog was
		// already flat). The deck + size are device-aware, but the appId is fixed.
		expect(matchWindow('vcr')?.appId).toBe('vcr');
	});

	it('resolves the vcr window device-aware through the flat spec', async () => {
		// SpecCtx bans the reactive os but allows module stores, so the flat vcr
		// spec reads vcrPrefs.device for both size and component — the deck swap +
		// resize that used to live in synthWindowDefs + the Desktop arm. Exercise
		// both decks (matchWindow recomputes per call, so it sees the live device)
		// and restore the prior setting.
		const ctx = { args: {}, fs: undefined as never };
		const prev = vcrPrefs.device;
		try {
			vcrPrefs.setDevice('ag500r');
			const ag = matchWindow('vcr')?.spec;
			expect(ag).toBeTruthy();
			expect(ag!.size(ctx)).toEqual({ w: 900, h: 560, minW: 620, minH: 420 });
			expect((await ag!.component()).default).toBe(VCRWindowAG500R);

			vcrPrefs.setDevice('generic');
			const gen = matchWindow('vcr')?.spec;
			expect(gen).toBeTruthy();
			expect(gen!.size(ctx)).toEqual({ w: 560, h: 523, minW: 480, minH: 470 });
			expect((await gen!.component()).default).toBe(VCRWindowGeneric);
		} finally {
			vcrPrefs.setDevice(prev);
		}
	});

	it('parses a per-app About id into the system app + its appId arg', () => {
		// openAbout('vcr') opens about:vcr; AboutAppWindow reads args.appId to pick
		// which app's spec to render. The bare 'about' id matches the exact entry,
		// not this prefix.
		const m = matchWindow('about:vcr');
		expect(m?.appId).toBe('system');
		expect(m?.args.appId).toBe('vcr');
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
