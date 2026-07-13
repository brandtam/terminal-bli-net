/** Byte/hash helpers shared by the Dialer's auth and session modules. */

export function bytesToBase64Url(bytes: Uint8Array): string {
	const bin = [...bytes].map((byte) => String.fromCharCode(byte)).join('');
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
	const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64);
	return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

export async function sha256Base64Url(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return bytesToBase64Url(new Uint8Array(digest));
}
