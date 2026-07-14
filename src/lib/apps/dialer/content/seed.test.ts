import { describe, it, expect } from 'vitest';
import { canonDateEpoch, canonSeedSql, canonFilesSql } from './seed';
import { formatEraDate, trainsAt } from './types';
import { RUSTY_DISKETTE } from './rusty-diskette';
import { NIGHT_CIRCUIT } from './night-circuit';
import { FOUNDRY } from './foundry';
import { CANON_SYSTEMS } from './index';
import { BOARD_SECTIONS, isPublicBoard } from '$lib/server/dialer/boards';

describe('canon seed migration', () => {
	it('the committed Rusty Diskette seed matches the content module', async () => {
		// The migration is the generator's output, locked here. If a content edit
		// fails this test, regenerate: pnpm test:unit -- --update
		await expect(canonSeedSql(RUSTY_DISKETTE)).toMatchFileSnapshot(
			'../../../../../migrations/dialer/0003_canon_rusty_diskette.sql'
		);
	});

	it('the committed Night Circuit seed matches the content module', async () => {
		await expect(canonSeedSql(NIGHT_CIRCUIT)).toMatchFileSnapshot(
			'../../../../../migrations/dialer/0004_canon_night_circuit.sql'
		);
	});

	it('the committed Foundry seed matches the content module', async () => {
		await expect(canonSeedSql(FOUNDRY)).toMatchFileSnapshot(
			'../../../../../migrations/dialer/0005_canon_foundry.sql'
		);
	});

	it('the committed canon file seed matches the content modules', async () => {
		// One migration covers all three public boards' file areas. LODESTONE has
		// no files and no live layer; Back Room files never leave the client.
		const sql = [RUSTY_DISKETTE, NIGHT_CIRCUIT, FOUNDRY].map(canonFilesSql).join('\n');
		await expect(sql).toMatchFileSnapshot('../../../../../migrations/dialer/0007_canon_files.sql');
	});

	it('escapes single quotes SQL-style', () => {
		const sql = canonSeedSql({
			...RUSTY_DISKETTE,
			sections: [
				{
					slug: 'general',
					title: 'General',
					topics: [
						{
							slug: 'quotes',
							title: "CAN'T STOP",
							posts: [{ author: 'CAPT.VECTOR', date: '10/01/87', body: "it's the drive's fault" }]
						}
					]
				}
			]
		});
		expect(sql).toContain("'CAN''T STOP'");
		expect(sql).toContain("'it''s the drive''s fault'");
	});

	it('same-day replies stay in authored order', () => {
		const halloween = RUSTY_DISKETTE.sections[0].topics[0];
		// Two posts share 10/10/87; the seed offsets by thread position.
		const sql = canonSeedSql(RUSTY_DISKETTE);
		const base = canonDateEpoch('10/10/87');
		expect(sql).toContain(`${base + 60}`); // post index 1
		expect(sql).toContain(`${base + 120}`); // post index 2
		expect(halloween.posts[1].date).toBe('10/10/87');
		expect(halloween.posts[2].date).toBe('10/10/87');
	});
});

describe('canon dates', () => {
	it('parses MM/DD/YY into the 1900s and round-trips through formatEraDate', () => {
		for (const system of CANON_SYSTEMS) {
			for (const section of system.sections) {
				for (const topic of section.topics) {
					for (const post of topic.posts) {
						const epoch = canonDateEpoch(post.date);
						expect(new Date(epoch * 1000).getUTCFullYear()).toBe(1987);
						expect(formatEraDate(epoch)).toBe(post.date.slice(0, 8));
					}
				}
			}
		}
	});

	it('accepts an optional HH:MM (Mainframe Mary posts at 3 AM)', () => {
		expect(canonDateEpoch('10/09/87 03:12') - canonDateEpoch('10/09/87 03:00')).toBe(12 * 60);
		expect(() => canonDateEpoch('Oct 9 1987')).toThrow();
	});
});

describe('content sections bind to the locked server sections', () => {
	it('every canon section slug exists in BOARD_SECTIONS', () => {
		for (const system of CANON_SYSTEMS) {
			if (!isPublicBoard(system.id)) continue; // static systems have no live layer
			for (const section of system.sections) {
				expect(BOARD_SECTIONS[system.id], `${system.id}/${section.slug}`).toContain(section.slug);
			}
		}
	});
});

describe('baud caps', () => {
	it('LODESTONE trains at 300 only (SCANLOG.TXT: "tried 1200, it won\'t train")', () => {
		const lodestone = CANON_SYSTEMS.find((s) => s.id === 'lodestone')!;
		expect(trainsAt(lodestone, 300)).toBe(true);
		expect(trainsAt(lodestone, 1200)).toBe(false);
		expect(trainsAt(lodestone, 2400)).toBe(false);
		expect(trainsAt(lodestone, 9600)).toBe(false);
	});

	it('an uncapped system trains at any rate', () => {
		const rusty = CANON_SYSTEMS.find((s) => s.id === 'rusty-diskette')!;
		expect(rusty.maxBaud).toBeUndefined();
		expect(trainsAt(rusty, 9600)).toBe(true);
	});
});
