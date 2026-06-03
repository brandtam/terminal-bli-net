/**
 * Email composition and HMAC-signed unsubscribe helpers for reminder emails.
 */
/* eslint-disable no-undef */

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------

const ALGO = { name: 'HMAC', hash: 'SHA-256' } as const;
const TOKEN_BYTES = 24;
const DOMAIN = 'bli.net';

async function importKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign', 'verify']);
}

function bytesToBase64Url(bytes: Uint8Array): string {
	const bin = [...bytes].map((byte) => String.fromCharCode(byte)).join('');
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Produce a compact deterministic token for email ownership flows.
 *
 * The token is HMAC-backed and stored with the subscriber record before it is
 * accepted again from email routing or confirmation links.
 */
export async function createEmailActionToken(payload: string, secret: string): Promise<string> {
	const key = await importKey(secret);
	const enc = new TextEncoder();
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
	return bytesToBase64Url(new Uint8Array(sig).slice(0, TOKEN_BYTES));
}

/**
 * Produce an unsubscribe address.
 *
 * Format: `unsub+<token>@bli.net`
 *
 * The local part is intentionally short enough for SMTP limits. The token maps
 * back to a subscriber row; the email address itself is not embedded.
 */
export async function signUnsubscribeAddress(email: string, secret: string): Promise<string> {
	return `unsub+${await createEmailActionToken(`unsubscribe:${email}`, secret)}@${DOMAIN}`;
}

/**
 * Extract the compact unsubscribe token from an inbound email address.
 */
export function extractUnsubscribeToken(signedAddr: string): string | null {
	// Strip the @domain portion
	const atIdx = signedAddr.lastIndexOf('@');
	if (atIdx === -1) return null;

	const domain = signedAddr.substring(atIdx + 1).toLowerCase();
	if (domain !== DOMAIN) return null;

	const localPart = signedAddr.substring(0, atIdx);

	// Strip the `unsub+` prefix
	const PREFIX = 'unsub+';
	if (!localPart.startsWith(PREFIX)) {
		return null;
	}

	const token = localPart.substring(PREFIX.length);
	return /^[A-Za-z0-9_-]{32}$/.test(token) ? token : null;
}

// ---------------------------------------------------------------------------
// Email composition
// ---------------------------------------------------------------------------

export interface ComposeReminderParams {
	showName: string;
	characterName: string;
	characterPrompt: string;
	signedReplyAddr: string;
	nextAirTime: string;
}

/**
 * Compose a reminder email in the character's voice.
 *
 * Returns the subject line, plain-text body, and List-Unsubscribe mailto header.
 */
export function composeReminder(params: ComposeReminderParams): {
	subject: string;
	body: string;
	headers: Record<string, string>;
} {
	const { showName, characterName, characterPrompt, signedReplyAddr, nextAirTime } = params;

	// Extract a greeting cue from the prompt — look for text after "greeting"
	// in the character prompt, or fall back to a generic opener.
	const greetingMatch = characterPrompt.match(/greeting["']?\s*:\s*["'](.+?)["']/i);
	const greeting = greetingMatch ? greetingMatch[1] : `Hey there, it's ${characterName}.`;

	const subject = `${showName} is on the air soon — ${characterName}`;

	const body = [
		greeting,
		'',
		`${showName} goes on the air at ${nextAirTime}. Don't be late.`,
		'',
		`See you there,`,
		characterName,
		'',
		'---',
		'To unsubscribe, reply to this email or click the unsubscribe link in your mail client.'
	].join('\n');

	const headers: Record<string, string> = {
		'List-Unsubscribe': `<mailto:${signedReplyAddr}>`
	};

	return { subject, body, headers };
}
