import { describe, it, expect } from 'vitest';
import { isViewportBlocked } from './viewport-gate';

const fine = (width: number, height: number) => ({ width, height, coarsePointer: false });
const coarse = (width: number, height: number) => ({ width, height, coarsePointer: true });

describe('isViewportBlocked', () => {
	describe('fine pointer (mouse/trackpad)', () => {
		it('allows a normal desktop viewport', () => {
			expect(isViewportBlocked(fine(1280, 800))).toBe(false);
		});

		it('allows exactly 720px wide (historical boundary)', () => {
			expect(isViewportBlocked(fine(720, 900))).toBe(false);
		});

		it('blocks a narrow window', () => {
			expect(isViewportBlocked(fine(640, 900))).toBe(true);
		});
	});

	describe('coarse pointer (tablet/phone)', () => {
		it('allows an iPad in landscape', () => {
			expect(isViewportBlocked(coarse(1024, 768))).toBe(false);
		});

		it('allows an iPad in portrait — rotation must not raise the wall', () => {
			expect(isViewportBlocked(coarse(768, 1024))).toBe(false);
		});

		it('allows an iPad Mini in portrait (744px wide)', () => {
			expect(isViewportBlocked(coarse(744, 1133))).toBe(false);
		});

		it('allows a small 600px-wide Android tablet in portrait', () => {
			expect(isViewportBlocked(coarse(600, 960))).toBe(false);
		});

		it('blocks a phone in portrait', () => {
			expect(isViewportBlocked(coarse(390, 844))).toBe(true);
		});

		it('blocks a phone in landscape, even though it clears the old width gate', () => {
			expect(isViewportBlocked(coarse(844, 390))).toBe(true);
		});

		it('gives the same verdict in both orientations for any device', () => {
			const devices: Array<[number, number]> = [
				[1024, 768], // iPad
				[744, 1133], // iPad Mini
				[600, 960], // small tablet
				[390, 844], // iPhone
				[430, 932], // iPhone Pro Max
				[412, 915] // Pixel
			];
			for (const [w, h] of devices) {
				expect(isViewportBlocked(coarse(w, h))).toBe(isViewportBlocked(coarse(h, w)));
			}
		});
	});
});
