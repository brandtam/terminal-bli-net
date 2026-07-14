import { describe, it, expect } from 'vitest';
import { TerminalFS } from '$lib/terminalos/filesystem/terminal-fs';
import {
	freshProgress,
	loadProgress,
	saveProgress,
	sightNumber,
	verifySystem,
	type DialerProgress
} from './persistence';

const SESSION = { handle: 'PHREAK.99', token: 'tok-abc123', expiresAt: 1_800_000_000 };

function createDisk() {
	return TerminalFS.createCleanDisk();
}

function withSession(): DialerProgress {
	return { ...freshProgress(), handle: SESSION.handle, session: SESSION };
}

async function appDataFile(
	fs: TerminalFS,
	name: string
): Promise<{ id: string; text: string | null } | null> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return null;
	const listing = await fs.listFolder(folder.value);
	if (!listing.ok) return null;
	const file = listing.value.find((n) => n.kind === 'file' && n.name === name);
	return file ? { id: file.id, text: fs.readText(file.id) } : null;
}

describe('dialer progress (AppData)', () => {
	it('a fresh disk loads fresh progress', async () => {
		const fs = createDisk();
		expect(await loadProgress(fs)).toEqual(freshProgress());
	});

	it('round-trips the whole progress shape through progress.json', async () => {
		const fs = createDisk();
		const progress: DialerProgress = {
			handle: 'PHREAK.99',
			session: SESSION,
			foundNumbers: [{ number: '5558008', source: 'the Grapevine' }],
			verifiedSystems: ['rusty-diskette'],
			readPosts: ['night-circuit'],
			scanlogs: [{ block: '5550100-5550199', date: '87-10-31', lines: ['5550113 ... CARRIER'] }],
			lodestoneUnlocked: true,
			doorHighScore: 616
		};
		await saveProgress(fs, progress);
		expect(await loadProgress(fs)).toEqual(progress);

		// A second save updates the same file — no duplicates in AppData.
		await saveProgress(fs, freshProgress());
		expect(await loadProgress(fs)).toEqual(freshProgress());
		const folder = await fs.getAppDataFolder('dialer');
		if (!folder.ok) throw new Error('no appdata');
		const listing = await fs.listFolder(folder.value);
		if (!listing.ok) throw new Error('no listing');
		expect(listing.value.filter((n) => n.name === 'progress.json')).toHaveLength(1);
	});

	it('writes a human-readable PHONEBOOK.TXT alongside the state', async () => {
		const fs = createDisk();
		let progress = verifySystem(freshProgress(), 'rusty-diskette');
		progress = sightNumber(progress, '5558008', 'the Grapevine');
		await saveProgress(fs, progress);

		const phonebook = await appDataFile(fs, 'PHONEBOOK.TXT');
		expect(phonebook?.text).toContain('The Rusty Diskette');
		expect(phonebook?.text).toContain('555-2323');
		expect(phonebook?.text).toContain('555-8008');
		expect(phonebook?.text).toContain('?UNVERIFIED?');
	});

	it('heals a corrupt file to fresh progress and rewrites it', async () => {
		const fs = createDisk();
		await saveProgress(fs, withSession());
		const file = await appDataFile(fs, 'progress.json');
		if (!file) throw new Error('no progress file');
		await fs.writeText(file.id, '{not json');

		expect(await loadProgress(fs)).toEqual(freshProgress());
		const healed = await appDataFile(fs, 'progress.json');
		expect(JSON.parse(healed?.text ?? '')).toEqual(freshProgress());
	});

	it('treats a wrong-shaped session as corrupt', async () => {
		const fs = createDisk();
		await saveProgress(fs, withSession());
		const file = await appDataFile(fs, 'progress.json');
		if (!file) throw new Error('no progress file');
		await fs.writeText(file.id, JSON.stringify({ session: { handle: 42 } }));
		expect(await loadProgress(fs)).toEqual(freshProgress());
	});

	it('tolerates a legacy {session} file, filling the rest fresh', async () => {
		const fs = createDisk();
		const folder = await fs.getAppDataFolder('dialer');
		if (!folder.ok) throw new Error('no appdata');
		await fs.createFile(folder.value, 'progress.json', {
			appId: 'dialer',
			text: JSON.stringify({ session: SESSION })
		});
		const loaded = await loadProgress(fs);
		expect(loaded.session).toEqual(SESSION);
		expect(loaded.handle).toBe('PHREAK.99');
		expect(loaded.foundNumbers).toEqual([]);
	});
});

describe('phonebook bookkeeping', () => {
	it('sights a number once and drops it when the system is verified', () => {
		let progress = sightNumber(freshProgress(), '5558008', 'a post');
		progress = sightNumber(progress, '5558008', 'again'); // idempotent
		expect(progress.foundNumbers).toHaveLength(1);

		progress = verifySystem(progress, 'night-circuit'); // 555-8008
		expect(progress.foundNumbers).toHaveLength(0);
		expect(progress.verifiedSystems).toContain('night-circuit');
	});

	it('never sights the number of an already-verified system', () => {
		const verified = verifySystem(freshProgress(), 'rusty-diskette');
		const same = sightNumber(verified, '5552323', 'a post');
		expect(same.foundNumbers).toHaveLength(0);
	});

	it('ignores malformed numbers', () => {
		expect(sightNumber(freshProgress(), '55523', 'x').foundNumbers).toHaveLength(0);
	});
});
