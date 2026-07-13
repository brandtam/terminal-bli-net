import { describe, it, expect } from 'vitest';
import { TerminalFS } from '$lib/terminalos/filesystem/terminal-fs';
import { loadProgress, saveProgress } from './persistence';

const SESSION = { handle: 'PHREAK.99', token: 'tok-abc123', expiresAt: 1_800_000_000 };

function createDisk() {
	return TerminalFS.createCleanDisk();
}

async function progressFile(fs: TerminalFS): Promise<{ id: string; text: string | null } | null> {
	const folder = await fs.getAppDataFolder('dialer');
	if (!folder.ok) return null;
	const listing = await fs.listFolder(folder.value);
	if (!listing.ok) return null;
	const file = listing.value.find((n) => n.kind === 'file' && n.name === 'progress.json');
	return file ? { id: file.id, text: fs.readText(file.id) } : null;
}

describe('dialer progress (AppData)', () => {
	it('a fresh disk loads fresh progress', async () => {
		const fs = createDisk();
		expect(await loadProgress(fs)).toEqual({ session: null });
	});

	it('round-trips the session through progress.json', async () => {
		const fs = createDisk();
		await saveProgress(fs, { session: SESSION });
		expect(await loadProgress(fs)).toEqual({ session: SESSION });

		// A second save updates the same file — no duplicates in AppData.
		await saveProgress(fs, { session: null });
		expect(await loadProgress(fs)).toEqual({ session: null });
		const folder = await fs.getAppDataFolder('dialer');
		if (!folder.ok) throw new Error('no appdata');
		const listing = await fs.listFolder(folder.value);
		if (!listing.ok) throw new Error('no listing');
		expect(listing.value.filter((n) => n.name === 'progress.json')).toHaveLength(1);
	});

	it('heals a corrupt file to fresh progress and rewrites it', async () => {
		const fs = createDisk();
		await saveProgress(fs, { session: SESSION });
		const file = await progressFile(fs);
		if (!file) throw new Error('no progress file');
		await fs.writeText(file.id, '{not json');

		expect(await loadProgress(fs)).toEqual({ session: null });
		const healed = await progressFile(fs);
		expect(JSON.parse(healed?.text ?? '')).toEqual({ session: null });
	});

	it('treats a wrong-shaped session as corrupt', async () => {
		const fs = createDisk();
		await saveProgress(fs, { session: SESSION });
		const file = await progressFile(fs);
		if (!file) throw new Error('no progress file');
		await fs.writeText(file.id, JSON.stringify({ session: { handle: 42 } }));
		expect(await loadProgress(fs)).toEqual({ session: null });
	});
});
