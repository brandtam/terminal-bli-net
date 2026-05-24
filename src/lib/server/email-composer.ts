/**
 * Email composition and HMAC-signed unsubscribe helpers for reminder emails.
 */

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------

const ALGO = { name: 'HMAC', hash: 'SHA-256' } as const;
const SEPARATOR = '--';

async function importKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign', 'verify']);
}

function bufToHex(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): ArrayBuffer {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes.buffer;
}

/**
 * Produce an HMAC-signed unsubscribe address.
 *
 * Format: `unsub+<hex-signature>--<email>@chatrbot.ai`
 *
 * The signature covers the subscriber email so that only a valid signature
 * can trigger an unsubscribe (prevents spoofed unsubscribe requests).
 */
export async function signUnsubscribeAddress(
	email: string,
	secret: string
): Promise<string> {
	const key = await importKey(secret);
	const enc = new TextEncoder();
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(email));
	const hex = bufToHex(sig);
	return `unsub+${hex}${SEPARATOR}${email}@chatrbot.ai`;
}

/**
 * Verify an HMAC-signed unsubscribe address and extract the subscriber email.
 */
export async function verifyUnsubscribeAddress(
	signedAddr: string,
	secret: string
): Promise<{ valid: boolean; email: string }> {
	// Strip the @domain portion
	const atIdx = signedAddr.lastIndexOf('@');
	const localPart = atIdx !== -1 ? signedAddr.substring(0, atIdx) : signedAddr;

	// Strip the `unsub+` prefix
	const PREFIX = 'unsub+';
	if (!localPart.startsWith(PREFIX)) {
		return { valid: false, email: '' };
	}

	const payload = localPart.substring(PREFIX.length);
	const sepIdx = payload.indexOf(SEPARATOR);
	if (sepIdx === -1) {
		return { valid: false, email: '' };
	}

	const hex = payload.substring(0, sepIdx);
	const email = payload.substring(sepIdx + SEPARATOR.length);

	if (!hex || !email) {
		return { valid: false, email: '' };
	}

	const key = await importKey(secret);
	const enc = new TextEncoder();
	const valid = await crypto.subtle.verify('HMAC', key, hexToBuf(hex), enc.encode(email));

	return { valid, email };
}

// ---------------------------------------------------------------------------
// Email composition
// ---------------------------------------------------------------------------

export interface ComposeReminderParams {
	showName: string;
	characterName: string;
	characterPrompt: string;
	recipientEmail: string;
	signedReplyAddr: string;
	nextAirTime: string;
}

/**
 * Compose a reminder email in the character's voice.
 *
 * Returns the subject line, plain-text body, and RFC 8058 List-Unsubscribe
 * headers so mailbox providers can surface a one-click unsubscribe button.
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
		'List-Unsubscribe': `<mailto:${signedReplyAddr}>`,
		'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
	};

	return { subject, body, headers };
}
