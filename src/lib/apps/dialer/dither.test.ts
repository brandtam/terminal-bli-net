import { describe, it, expect } from 'vitest';
import { CGA_RGB, ditherToIndices, encodeIndexedPng, fitDimensions, nearestCga } from './dither';
import { verifyCgaPng } from '$lib/server/dialer/files';

describe('CGA quantization', () => {
	it('snaps exact CGA colors to their own index', () => {
		CGA_RGB.forEach(([r, g, b], i) => {
			expect(nearestCga(r, g, b)).toBe(i);
		});
	});

	it('maps near-black to black and near-white to white', () => {
		expect(nearestCga(4, 4, 4)).toBe(0);
		expect(nearestCga(250, 250, 250)).toBe(15);
	});
});

describe('fitDimensions', () => {
	it('leaves small images alone', () => {
		expect(fitDimensions(320, 200)).toEqual({ width: 320, height: 200 });
	});

	it('scales oversized images inside 640x400, preserving aspect', () => {
		expect(fitDimensions(1280, 800)).toEqual({ width: 640, height: 400 });
		const wide = fitDimensions(1280, 400);
		expect(wide.width).toBe(640);
		expect(wide.height).toBe(200);
	});
});

describe('the encoded PNG passes the server verifier', () => {
	function solid(width: number, height: number, index: number): Uint8Array {
		return new Uint8Array(width * height).fill(index);
	}

	it('a dithered gradient encodes to a PNG the upload route accepts', () => {
		const width = 32;
		const height = 24;
		const rgba = new Uint8ClampedArray(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const p = (y * width + x) * 4;
				rgba[p] = (x / width) * 255;
				rgba[p + 1] = (y / height) * 255;
				rgba[p + 2] = 128;
				rgba[p + 3] = 255;
			}
		}
		const indices = ditherToIndices(rgba, width, height);
		const png = encodeIndexedPng(indices, width, height);
		const verdict = verifyCgaPng(png);
		expect(verdict).toEqual({ ok: true, width, height });
		expect(png.length).toBeLessThanOrEqual(65_536);
	});

	it('a solid-color image round-trips through encode → verify', () => {
		const png = encodeIndexedPng(solid(16, 16, 9), 16, 16);
		expect(verifyCgaPng(png).ok).toBe(true);
	});

	it('is deterministic — same pixels, same bytes', () => {
		const indices = solid(8, 8, 3);
		expect(encodeIndexedPng(indices, 8, 8)).toEqual(encodeIndexedPng(indices, 8, 8));
	});
});
