import { env } from './env';
import { describe, it, expect } from 'vitest';
import { registerCaller } from '../auth';
import {
	downloadFile,
	grantUploadCredits,
	listFiles,
	setFileVisible,
	softDeleteFile,
	uploadImageFile,
	uploadTextFile,
	UPLOADS_PER_DAY,
	UPLOAD_CREDITS
} from '../files';
import { systemById } from '../../../apps/dialer/content';
import { pngFixture } from './png-fixture';

const NOW = new Date('2026-07-12T12:00:00Z');

// Storage is shared across tests (no pool isolation): every test registers
// its own unique handle and uploads unique filenames.

async function caller(handle: string): Promise<string> {
	const result = await registerCaller(env.DIALER_DB, handle, 'password', null, NOW);
	if (!result.ok) throw new Error(`test caller ${handle} not registered`);
	return result.handle;
}

async function visibleUpload(handle: string, name: string, body = 'hello'): Promise<string> {
	const result = await uploadTextFile(
		env.DIALER_DB,
		'rusty-diskette',
		handle,
		{ name, kind: 'txt', body },
		NOW
	);
	if (!result.ok) throw new Error(`upload ${name} failed: ${result.reason}`);
	await setFileVisible(env.DIALER_DB, result.id);
	return result.id;
}

describe('canon file seed (migrations 0006-0007)', () => {
	it('lists canon files first, in module order, with authored counts', async () => {
		const files = await listFiles(env.DIALER_DB, 'rusty-diskette');
		const canon = files.filter((f) => f.canon);
		const authored = systemById('rusty-diskette')!.files;
		expect(canon.map((f) => f.name)).toEqual(authored.map((f) => f.name));
		const foundry = canon.find((f) => f.name === 'FOUNDRY.TXT');
		expect(foundry?.uploader).toBe('SLAG');
		expect(foundry?.downloads).toBe(149);
	});

	it('serves breadcrumb #2 (The Foundry number) from the canon body', async () => {
		const handle = await caller('FILEHUNTER');
		const files = await listFiles(env.DIALER_DB, 'rusty-diskette');
		const foundry = files.find((f) => f.name === 'FOUNDRY.TXT')!;
		const result = await downloadFile(env.DIALER_DB, foundry.id, handle);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.bodyText).toContain('555-4477');
	});
});

describe('text uploads', () => {
	it('lands hidden, lists after moderation clears it, and earns credits then', async () => {
		const handle = await caller('UPLOADER1');
		const result = await uploadTextFile(
			env.DIALER_DB,
			'rusty-diskette',
			handle,
			{ name: 'notes1.txt', kind: 'txt', body: 'field notes' },
			NOW
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		let files = await listFiles(env.DIALER_DB, 'rusty-diskette');
		expect(files.find((f) => f.name === 'NOTES1.TXT')).toBeUndefined();

		await setFileVisible(env.DIALER_DB, result.id);
		await grantUploadCredits(env.DIALER_DB, handle);
		files = await listFiles(env.DIALER_DB, 'rusty-diskette');
		expect(files.find((f) => f.name === 'NOTES1.TXT')?.uploader).toBe('UPLOADER1');

		const row = await env.DIALER_DB.prepare(
			'SELECT ratio_credits, uploads_today FROM callers WHERE handle = ?1'
		)
			.bind(handle)
			.first<{ ratio_credits: number; uploads_today: number }>();
		expect(row?.ratio_credits).toBe(3 + UPLOAD_CREDITS);
		expect(row?.uploads_today).toBe(1);
	});

	it('refuses bad names, duplicate names, and the 4th upload of the day', async () => {
		const handle = await caller('UPLOADER2');
		const bad = await uploadTextFile(
			env.DIALER_DB,
			'rusty-diskette',
			handle,
			{ name: 'not a real filename', kind: 'txt', body: 'x' },
			NOW
		);
		expect(bad).toEqual({ ok: false, reason: 'invalid-name' });

		await visibleUpload(handle, 'DUPE2.TXT');
		const dupe = await uploadTextFile(
			env.DIALER_DB,
			'rusty-diskette',
			handle,
			{ name: 'dupe2.txt', kind: 'txt', body: 'again' },
			NOW
		);
		expect(dupe).toEqual({ ok: false, reason: 'duplicate-name' });

		// The dupe refusal never claimed a slot, so these are uploads #2 and #3.
		await visibleUpload(handle, 'SECOND2.TXT');
		await visibleUpload(handle, 'THIRD2.TXT');
		const fourth = await uploadTextFile(
			env.DIALER_DB,
			'rusty-diskette',
			handle,
			{ name: 'FOURTH2.TXT', kind: 'txt', body: 'one too many' },
			NOW
		);
		expect(fourth).toEqual({ ok: false, reason: 'daily-limit' });
		expect(UPLOADS_PER_DAY).toBe(3);
	});
});

describe('the ratio economy', () => {
	it('spends one credit per download and refuses at zero, in parallel too', async () => {
		const handle = await caller('FREELOADER');
		const files = await listFiles(env.DIALER_DB, 'rusty-diskette');
		const canon = files.filter((f) => f.canon).slice(0, 3);

		// 3 starter credits: exactly three downloads.
		for (const file of canon) {
			const result = await downloadFile(env.DIALER_DB, file.id, handle);
			expect(result.ok).toBe(true);
		}
		const fourth = await downloadFile(env.DIALER_DB, canon[0].id, handle);
		expect(fourth).toEqual({ ok: false, reason: 'ratio' });
	});

	it('bumps the download counter only when the claim wins', async () => {
		const handle = await caller('COUNTER-CHECK');
		const id = await visibleUpload(handle, 'COUNTME.TXT');
		const before = (await listFiles(env.DIALER_DB, 'rusty-diskette')).find((f) => f.id === id)!;
		await downloadFile(env.DIALER_DB, id, handle);
		const after = (await listFiles(env.DIALER_DB, 'rusty-diskette')).find((f) => f.id === id)!;
		expect(after.downloads).toBe(before.downloads + 1);
	});

	it('never lets a soft-deleted or hidden file download', async () => {
		const handle = await caller('GHOSTPULL');
		const id = await visibleUpload(handle, 'GHOST.TXT');
		await softDeleteFile(env.DIALER_DB, id, NOW);
		expect(await downloadFile(env.DIALER_DB, id, handle)).toEqual({
			ok: false,
			reason: 'no-file'
		});
	});
});

describe('image uploads', () => {
	it('stores a verified CGA PNG in R2 and serves its key back on download', async () => {
		const handle = await caller('PIXELPUSH');
		const bytes = pngFixture();
		const result = await uploadImageFile(
			env.DIALER_DB,
			env.DIALER_FILES,
			'rusty-diskette',
			handle,
			{ name: 'ART1.PNG', bytes },
			NOW
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		await setFileVisible(env.DIALER_DB, result.id);

		const download = await downloadFile(env.DIALER_DB, result.id, handle);
		expect(download.ok).toBe(true);
		if (!download.ok) return;
		expect(download.r2Key).toBe(`rusty-diskette/${result.id}.png`);
		const object = await env.DIALER_FILES.get(download.r2Key!);
		expect(object).not.toBeNull();
		expect((await object!.arrayBuffer()).byteLength).toBe(bytes.length);
	});

	it('refuses a non-indexed PNG before touching R2 or the upload budget', async () => {
		const handle = await caller('TRUECOLOR');
		const result = await uploadImageFile(
			env.DIALER_DB,
			env.DIALER_FILES,
			'rusty-diskette',
			handle,
			{ name: 'RGB.PNG', bytes: pngFixture({ colorType: 2 }) },
			NOW
		);
		expect(result).toEqual({ ok: false, reason: 'invalid-body' });
		const row = await env.DIALER_DB.prepare('SELECT uploads_today FROM callers WHERE handle = ?1')
			.bind(handle)
			.first<{ uploads_today: number }>();
		expect(row?.uploads_today).toBe(0);
	});
});
