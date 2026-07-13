/// <reference types="@cloudflare/workers-types" />
/**
 * Opaque bearer sessions (architecture item 4): 32 random bytes base64url; D1
 * stores only the SHA-256, so a leaked database can't mint valid tokens.
 * 30-day sliding expiry, bumped at most once a day so a busy caller doesn't
 * write on every request. The client keeps the token in AppData progress.json.
 */
import { epochSeconds } from './auth';
import { bytesToBase64Url, sha256Base64Url } from './encoding';

const SESSION_TTL_S = 30 * 24 * 60 * 60;
const BUMP_INTERVAL_S = 24 * 60 * 60;
const TOKEN_BYTES = 32;

export interface MintedSession {
	token: string;
	expiresAt: number;
}

export async function mintSession(
	db: D1Database,
	handle: string,
	now: Date
): Promise<MintedSession> {
	const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
	const nowS = epochSeconds(now);
	const expiresAt = nowS + SESSION_TTL_S;
	await db
		.prepare(
			'INSERT INTO sessions (token_hash, handle, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)'
		)
		.bind(await sha256Base64Url(token), handle, nowS, expiresAt)
		.run();
	return { token, expiresAt };
}

/** The handle the token belongs to, or null. Slides expiry (max once/day). */
export async function validateSession(
	db: D1Database,
	token: string,
	now: Date
): Promise<string | null> {
	if (!token) return null;
	const tokenHash = await sha256Base64Url(token);
	const row = await db
		.prepare('SELECT handle, expires_at FROM sessions WHERE token_hash = ?1')
		.bind(tokenHash)
		.first<{ handle: string; expires_at: number }>();

	const nowS = epochSeconds(now);
	if (!row || row.expires_at <= nowS) return null;

	if (row.expires_at < nowS + SESSION_TTL_S - BUMP_INTERVAL_S) {
		await db
			.prepare('UPDATE sessions SET expires_at = ?1 WHERE token_hash = ?2')
			.bind(nowS + SESSION_TTL_S, tokenHash)
			.run();
	}
	return row.handle;
}
