import { describe, it, expect } from 'vitest';
import { canonicalFileName, verifyCgaPng, IMAGE_MAX_BYTES } from './files';
import { pngFixture, CGA_16 } from './test/png-fixture';

describe('canonicalFileName', () => {
	it('uppercases and accepts 8.3-style names', () => {
		expect(canonicalFileName('scanlog.txt')).toBe('SCANLOG.TXT');
		expect(canonicalFileName('  molten2.nfo ')).toBe('MOLTEN2.NFO');
		expect(canonicalFileName('A.1')).toBe('A.1');
	});

	it('refuses names the era never saw', () => {
		expect(canonicalFileName('no extension')).toBeNull();
		expect(canonicalFileName('.hidden')).toBeNull();
		expect(canonicalFileName('waytoolongname.txt')).toBeNull();
		expect(canonicalFileName('bad/../path.txt')).toBeNull();
		expect(canonicalFileName('')).toBeNull();
	});
});

describe('verifyCgaPng', () => {
	it('accepts an indexed PNG whose palette is within the CGA 16', () => {
		expect(verifyCgaPng(pngFixture())).toEqual({ ok: true, width: 8, height: 8 });
		expect(verifyCgaPng(pngFixture({ palette: CGA_16.slice(0, 2), bitDepth: 1 })).ok).toBe(true);
		expect(verifyCgaPng(pngFixture({ width: 640, height: 400 })).ok).toBe(true);
	});

	it('refuses everything that is not a small indexed CGA PNG', () => {
		expect(verifyCgaPng(new Uint8Array([1, 2, 3])).ok).toBe(false); // not a PNG
		expect(verifyCgaPng(pngFixture({ colorType: 2 }))).toEqual({
			ok: false,
			reason: 'not-indexed'
		});
		expect(verifyCgaPng(pngFixture({ palette: [0x123456] }))).toEqual({
			ok: false,
			reason: 'off-palette'
		});
		expect(verifyCgaPng(pngFixture({ width: 641 }))).toEqual({
			ok: false,
			reason: 'bad-dimensions'
		});
		expect(verifyCgaPng(pngFixture({ height: 401 }))).toEqual({
			ok: false,
			reason: 'bad-dimensions'
		});
		expect(verifyCgaPng(pngFixture({ withTrns: true }))).toEqual({
			ok: false,
			reason: 'has-alpha'
		});
		expect(verifyCgaPng(pngFixture({ withPlte: false }))).toEqual({
			ok: false,
			reason: 'no-palette'
		});
		expect(verifyCgaPng(pngFixture({ withIdat: false }))).toEqual({
			ok: false,
			reason: 'no-image-data'
		});
	});

	it('refuses oversized and truncated bytes without walking off the buffer', () => {
		expect(verifyCgaPng(new Uint8Array(IMAGE_MAX_BYTES + 1))).toEqual({
			ok: false,
			reason: 'too-big'
		});
		const truncated = pngFixture().slice(0, 20);
		expect(verifyCgaPng(truncated).ok).toBe(false);
	});
});
