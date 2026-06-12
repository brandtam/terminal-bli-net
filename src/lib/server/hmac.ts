/* eslint-disable no-undef */

const ALGO = { name: 'HMAC', hash: 'SHA-256' } as const;
const DEFAULT_TOKEN_BYTES = 24;

function bytesToBase64Url(bytes: Uint8Array): string {
	const bin = [...bytes].map((byte) => String.fromCharCode(byte)).join('');
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign']);
}

export async function signHmacBase64Url(
	secret: string,
	payload: string,
	bytes = DEFAULT_TOKEN_BYTES
): Promise<string> {
	const enc = new TextEncoder();
	const key = await importHmacKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return bytesToBase64Url(new Uint8Array(sig).slice(0, bytes));
}

/** Constant-time compare of two equal-length strings. */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}
