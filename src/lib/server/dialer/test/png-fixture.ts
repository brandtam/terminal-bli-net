/**
 * Hand-built PNG bytes for the CGA verification tests. The verifier walks
 * chunk structure only (no inflate, no CRC check), so the fixtures skip real
 * compression and checksums too — what matters is signature, IHDR, PLTE, and
 * chunk framing.
 */

export const CGA_16 = [
	0x000000, 0xaa0000, 0x00aa00, 0xaa5500, 0x0000aa, 0xaa00aa, 0x00aaaa, 0xaaaaaa, 0x555555,
	0xff5555, 0x55ff55, 0xffff55, 0x5555ff, 0xff55ff, 0x55ffff, 0xffffff
];

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	new DataView(out.buffer).setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	return out; // CRC bytes stay zero — the verifier doesn't checksum
}

export interface PngFixtureOptions {
	width?: number;
	height?: number;
	colorType?: number;
	bitDepth?: number;
	palette?: number[];
	withTrns?: boolean;
	withPlte?: boolean;
	withIdat?: boolean;
}

export function pngFixture(options: PngFixtureOptions = {}): Uint8Array {
	const {
		width = 8,
		height = 8,
		colorType = 3,
		bitDepth = 4,
		palette = CGA_16,
		withTrns = false,
		withPlte = true,
		withIdat = true
	} = options;

	const ihdr = new Uint8Array(13);
	const dv = new DataView(ihdr.buffer);
	dv.setUint32(0, width);
	dv.setUint32(4, height);
	ihdr[8] = bitDepth;
	ihdr[9] = colorType;

	const plte = new Uint8Array(palette.length * 3);
	palette.forEach((rgb, i) => {
		plte[i * 3] = (rgb >> 16) & 0xff;
		plte[i * 3 + 1] = (rgb >> 8) & 0xff;
		plte[i * 3 + 2] = rgb & 0xff;
	});

	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		...(withPlte ? [chunk('PLTE', plte)] : []),
		...(withTrns ? [chunk('tRNS', new Uint8Array([0]))] : []),
		...(withIdat ? [chunk('IDAT', new Uint8Array(16))] : []),
		chunk('IEND', new Uint8Array(0))
	];

	const total = parts.reduce((sum, p) => sum + p.length, 0);
	const png = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png;
}
