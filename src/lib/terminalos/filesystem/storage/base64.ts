// Base64 codec for blob body bytes.
//
// Backups are JSON, so blob bytes have to ride as text. We use base64 via the
// btoa/atob globals (present in the browser, jsdom, and Node 18+). The encode
// path walks the bytes in chunks because String.fromCharCode(...bigArray) blows
// the argument/call-stack limit on large blobs.

const CHUNK_SIZE = 0x8000; // 32 KB per fromCharCode call

export function arrayBufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
