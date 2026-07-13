/// <reference types="@cloudflare/workers-types" />
/**
 * Handle + password identity, period-correct BBS rules (dialer prd, item 4 of
 * the architecture session):
 *
 * - Handles are uppercase-canonical `A-Z 0-9 . -`, 2-16 chars.
 * - PBKDF2-SHA256, 100k iterations, 16-byte salt (WebCrypto only).
 * - No recovery: lose the password, register a new handle.
 * - Brute force: 5 failed logins lock the handle for 15 minutes. The lock, a
 *   bad password, and an unknown handle all answer the same way (in-fiction
 *   NO CARRIER at the route), so nothing about an account leaks.
 * - Canon handles are seeded rows with pass_hash NULL — unregisterable and
 *   unloginable, so the fiction can't be impersonated.
 */
import { timingSafeEqual } from '../hmac';
import { bytesToBase64Url, base64UrlToBytes } from './encoding';

const HANDLE_RE = /^[A-Z0-9.-]{2,16}$/;
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 64;
/** The questionnaire is a short in-fiction form; cap what one caller can park in D1. */
const QUESTIONNAIRE_MAX_BYTES = 2048;
const LOCK_AFTER_FAILS = 5;
const LOCK_SECONDS = 15 * 60;
/** Ratio economy seed: registration grants 3 download credits (1:3 ratio). */
export const STARTER_RATIO_CREDITS = 3;

export type RegisterResult =
	| { ok: true; handle: string }
	| {
			ok: false;
			reason: 'invalid-handle' | 'invalid-password' | 'invalid-questionnaire' | 'taken';
	  };

export type LoginResult = { ok: true; handle: string } | { ok: false };

/** Uppercase-canonical handle, or null if it doesn't scan. */
export function canonicalizeHandle(raw: string): string | null {
	const handle = raw.trim().toUpperCase();
	return HANDLE_RE.test(handle) ? handle : null;
}

async function derivePassHash(password: string, salt: Uint8Array): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: salt as BufferSource },
		key,
		HASH_BYTES * 8
	);
	return bytesToBase64Url(new Uint8Array(bits));
}

export async function registerCaller(
	db: D1Database,
	rawHandle: string,
	password: string,
	questionnaireJson: string | null,
	now: Date
): Promise<RegisterResult> {
	const handle = canonicalizeHandle(rawHandle);
	if (!handle) return { ok: false, reason: 'invalid-handle' };
	if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
		return { ok: false, reason: 'invalid-password' };
	}
	if (
		questionnaireJson !== null &&
		new TextEncoder().encode(questionnaireJson).length > QUESTIONNAIRE_MAX_BYTES
	) {
		return { ok: false, reason: 'invalid-questionnaire' };
	}

	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const passHash = await derivePassHash(password, salt);

	// INSERT ... WHERE NOT EXISTS is atomic in SQLite, so a racing duplicate
	// registration loses cleanly (changes === 0) instead of surfacing as a
	// driver-specific constraint error. Canon rows already occupy their handles.
	const result = await db
		.prepare(
			`INSERT INTO callers (handle, pass_hash, salt, created_at, ratio_credits, questionnaire_json)
			 SELECT ?1, ?2, ?3, ?4, ?5, ?6
			 WHERE NOT EXISTS (SELECT 1 FROM callers WHERE handle = ?1)`
		)
		.bind(
			handle,
			passHash,
			bytesToBase64Url(salt),
			epochSeconds(now),
			STARTER_RATIO_CREDITS,
			questionnaireJson
		)
		.run();

	if (result.meta.changes === 0) return { ok: false, reason: 'taken' };
	return { ok: true, handle };
}

export async function loginCaller(
	db: D1Database,
	rawHandle: string,
	password: string,
	now: Date
): Promise<LoginResult> {
	const handle = canonicalizeHandle(rawHandle);
	if (!handle) return { ok: false };

	const row = await db
		.prepare('SELECT pass_hash, salt, locked_until FROM callers WHERE handle = ?1')
		.bind(handle)
		.first<{ pass_hash: string | null; salt: string | null; locked_until: number | null }>();

	// Unknown handle and canon handle (pass_hash NULL) fail identically.
	if (!row?.pass_hash || !row.salt) return { ok: false };

	const nowS = epochSeconds(now);
	if (row.locked_until !== null && row.locked_until > nowS) return { ok: false };

	const attempt = await derivePassHash(password, base64UrlToBytes(row.salt));
	if (!timingSafeEqual(attempt, row.pass_hash)) {
		// Count the miss; the Nth strike arms the 15-minute lock.
		await db
			.prepare(
				`UPDATE callers SET
				   failed_count = CASE WHEN failed_count + 1 >= ?2 THEN 0 ELSE failed_count + 1 END,
				   locked_until = CASE WHEN failed_count + 1 >= ?2 THEN ?3 ELSE locked_until END
				 WHERE handle = ?1`
			)
			.bind(handle, LOCK_AFTER_FAILS, nowS + LOCK_SECONDS)
			.run();
		return { ok: false };
	}

	await db
		.prepare(
			'UPDATE callers SET failed_count = 0, locked_until = NULL, last_seen = ?2 WHERE handle = ?1'
		)
		.bind(handle, nowS)
		.run();
	return { ok: true, handle };
}

export function epochSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000);
}
