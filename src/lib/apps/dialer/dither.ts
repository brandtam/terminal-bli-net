/**
 * Client-side 1-bit/CGA dithering for image uploads (PRD: "forced 1-bit/CGA
 * dither on upload, ≤64 KB post-dither"). The window picks a file, this maps
 * every pixel to the nearest of the 16 CGA colors with ordered (Bayer)
 * dithering, and encodes an indexed PNG — the exact shape the server's
 * verifyCgaPng accepts (indexed color, palette ⊆ CGA 16, ≤640×400, ≤64 KB).
 *
 * Ordered dithering, not error-diffusion, on purpose: it's fast, deterministic
 * (a given source always yields the same bytes — testable), and reads as
 * period-correct crosshatch. The heavy lifting (browser image decode, PNG
 * deflate) uses OffscreenCanvas where available and the DOM canvas otherwise.
 */

/** The 16 CGA colors as [r,g,b]. Index order is the classic CGA/ANSI order. */
export const CGA_RGB: [number, number, number][] = [
	[0x00, 0x00, 0x00],
	[0xaa, 0x00, 0x00],
	[0x00, 0xaa, 0x00],
	[0xaa, 0x55, 0x00],
	[0x00, 0x00, 0xaa],
	[0xaa, 0x00, 0xaa],
	[0x00, 0xaa, 0xaa],
	[0xaa, 0xaa, 0xaa],
	[0x55, 0x55, 0x55],
	[0xff, 0x55, 0x55],
	[0x55, 0xff, 0x55],
	[0xff, 0xff, 0x55],
	[0x55, 0x55, 0xff],
	[0xff, 0x55, 0xff],
	[0x55, 0xff, 0xff],
	[0xff, 0xff, 0xff]
];

export const MAX_WIDTH = 640;
export const MAX_HEIGHT = 400;

/** 4×4 Bayer matrix, normalized to [-0.5, 0.5) — the ordered-dither threshold. */
const BAYER_4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5]
].map((row) => row.map((v) => v / 16 - 0.5));

/** How far a nudged channel can move toward a neighboring level (0-255). */
const DITHER_STRENGTH = 64;

/**
 * Map RGBA pixels to CGA palette indices with ordered dithering. Pure and
 * deterministic, so it round-trips in tests without a canvas.
 */
export function ditherToIndices(
	rgba: Uint8ClampedArray,
	width: number,
	height: number
): Uint8Array {
	const indices = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const p = (y * width + x) * 4;
			const threshold = BAYER_4[y & 3][x & 3] * DITHER_STRENGTH;
			const r = clamp8(rgba[p] + threshold);
			const g = clamp8(rgba[p + 1] + threshold);
			const b = clamp8(rgba[p + 2] + threshold);
			indices[y * width + x] = nearestCga(r, g, b);
		}
	}
	return indices;
}

/** Nearest CGA index by squared-distance in RGB. */
export function nearestCga(r: number, g: number, b: number): number {
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i < CGA_RGB.length; i++) {
		const [cr, cg, cb] = CGA_RGB[i];
		const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	}
	return best;
}

/** Fit dimensions inside the CGA bounds, preserving aspect. */
export function fitDimensions(width: number, height: number): { width: number; height: number } {
	const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
	return {
		width: Math.max(1, Math.floor(width * scale)),
		height: Math.max(1, Math.floor(height * scale))
	};
}

function clamp8(value: number): number {
	return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Decode an image file, dither it to CGA, and return an indexed PNG as base64
 * — ready for the upload route, which verifies rather than re-dithers. Runs in
 * the browser (needs createImageBitmap + a canvas); rejects if the result
 * can't be brought under 64 KB even after a downscale retry.
 */
export async function ditherImageToPng(file: Blob): Promise<string> {
	const bitmap = await createImageBitmap(file);
	let { width, height } = fitDimensions(bitmap.width, bitmap.height);

	// Two attempts: full fit, then half-size if the first is over budget.
	for (let attempt = 0; attempt < 2; attempt++) {
		const rgba = drawToRgba(bitmap, width, height);
		const indices = ditherToIndices(rgba, width, height);
		const png = encodeIndexedPng(indices, width, height);
		if (png.length <= 65_536) {
			bitmap.close();
			return bytesToBase64(png);
		}
		width = Math.max(1, Math.floor(width / 2));
		height = Math.max(1, Math.floor(height / 2));
	}
	bitmap.close();
	throw new Error('image too complex to fit in 64 KB even downscaled');
}

function drawToRgba(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray {
	const canvas =
		typeof OffscreenCanvas !== 'undefined'
			? new OffscreenCanvas(width, height)
			: Object.assign(document.createElement('canvas'), { width, height });
	const ctx = canvas.getContext('2d') as
		| OffscreenCanvasRenderingContext2D
		| CanvasRenderingContext2D
		| null;
	if (!ctx) throw new Error('no 2d canvas context');
	ctx.drawImage(bitmap, 0, 0, width, height);
	return ctx.getImageData(0, 0, width, height).data;
}

// ── Minimal indexed-PNG encoder (no external deps) ──────────────────────────

/** Encode 4-bit indexed pixels as a PNG with a CGA PLTE. Uncompressed IDAT
 * (zlib stored blocks) keeps this dependency-free; the images are tiny. */
export function encodeIndexedPng(indices: Uint8Array, width: number, height: number): Uint8Array {
	const bitDepth = 4; // 16 colors
	const rowBytes = Math.ceil((width * bitDepth) / 8);
	const raw = new Uint8Array((rowBytes + 1) * height);
	for (let y = 0; y < height; y++) {
		const rowStart = y * (rowBytes + 1);
		raw[rowStart] = 0; // filter: none
		for (let x = 0; x < width; x++) {
			const idx = indices[y * width + x] & 0x0f;
			const byte = rowStart + 1 + (x >> 1);
			raw[byte] |= x & 1 ? idx : idx << 4;
		}
	}

	const plte = new Uint8Array(CGA_RGB.length * 3);
	CGA_RGB.forEach(([r, g, b], i) => {
		plte[i * 3] = r;
		plte[i * 3 + 1] = g;
		plte[i * 3 + 2] = b;
	});

	const ihdr = new Uint8Array(13);
	const dv = new DataView(ihdr.buffer);
	dv.setUint32(0, width);
	dv.setUint32(4, height);
	ihdr[8] = bitDepth;
	ihdr[9] = 3; // indexed color

	const chunks = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('PLTE', plte),
		chunk('IDAT', zlibStored(raw)),
		chunk('IEND', new Uint8Array(0))
	];
	return concat(chunks);
}

/** A zlib stream wrapping stored (uncompressed) deflate blocks + Adler-32. */
function zlibStored(data: Uint8Array): Uint8Array {
	const blocks: Uint8Array[] = [];
	const MAX = 0xffff;
	for (let offset = 0; offset < data.length || offset === 0; offset += MAX) {
		const slice = data.subarray(offset, offset + MAX);
		const final = offset + MAX >= data.length ? 1 : 0;
		const header = new Uint8Array(5);
		header[0] = final;
		header[1] = slice.length & 0xff;
		header[2] = (slice.length >> 8) & 0xff;
		header[3] = ~slice.length & 0xff;
		header[4] = (~slice.length >> 8) & 0xff;
		blocks.push(header, slice);
		if (data.length === 0) break;
	}
	const body = concat(blocks);
	const out = new Uint8Array(2 + body.length + 4);
	out[0] = 0x78; // zlib CMF
	out[1] = 0x01; // FLG (no dict, fastest)
	out.set(body, 2);
	const adler = adler32(data);
	new DataView(out.buffer).setUint32(2 + body.length, adler);
	return out;
}

function adler32(data: Uint8Array): number {
	let a = 1;
	let b = 0;
	for (const byte of data) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}
	return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const dv = new DataView(out.buffer);
	dv.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	const crcInput = out.subarray(4, 8 + data.length);
	dv.setUint32(8 + data.length, crc32(crcInput));
	return out;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, p) => sum + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}
