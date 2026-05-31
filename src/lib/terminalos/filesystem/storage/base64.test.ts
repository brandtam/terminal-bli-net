import { describe, it, expect } from 'vitest';
import { arrayBufferToBase64, base64ToArrayBuffer } from './base64';

// Copy bytes into a fresh ArrayBuffer so the type is exactly ArrayBuffer
// (TextEncoder().encode().buffer is typed ArrayBufferLike).
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buf = new ArrayBuffer(bytes.length);
	new Uint8Array(buf).set(bytes);
	return buf;
}

function roundTrip(bytes: Uint8Array): Uint8Array {
	const b64 = arrayBufferToBase64(toArrayBuffer(bytes));
	return new Uint8Array(base64ToArrayBuffer(b64));
}

describe('base64 codec', () => {
	it('round-trips an empty buffer', () => {
		const b64 = arrayBufferToBase64(new ArrayBuffer(0));
		expect(b64).toBe('');
		expect(base64ToArrayBuffer(b64).byteLength).toBe(0);
	});

	it('round-trips ASCII text', () => {
		const bytes = new TextEncoder().encode('hello, terminal');
		const out = roundTrip(bytes);
		expect(new TextDecoder().decode(out)).toBe('hello, terminal');
	});

	it('round-trips every byte value 0..255 exactly', () => {
		const bytes = new Uint8Array(256);
		for (let i = 0; i < 256; i++) bytes[i] = i;
		const out = roundTrip(bytes);
		expect(out).toEqual(bytes);
	});

	it('round-trips a large (>64KB) buffer exactly', () => {
		const bytes = new Uint8Array(100_000);
		for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) & 0xff;
		const out = roundTrip(bytes);
		expect(out.length).toBe(bytes.length);
		expect(out).toEqual(bytes);
	});
});
