/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect } from 'vitest';
import {
	composeReminder,
	createEmailActionToken,
	extractUnsubscribeToken,
	signUnsubscribeAddress,
	type ComposeReminderParams
} from './email-composer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-hmac-secret-key-1234';

const DEFAULT_PARAMS: ComposeReminderParams = {
	showName: 'M*A*S*H',
	characterName: 'Hawkeye',
	characterPrompt: 'greeting": "Well, hello there. Pull up a martini, soldier." voice: sardonic',
	signedReplyAddr: 'unsub+0123456789abcdefghijklmnopqrstuv@bli.net',
	nextAirTime: '7:00 PM EST'
};

// ---------------------------------------------------------------------------
// composeReminder
// ---------------------------------------------------------------------------

describe('composeReminder', () => {
	it('produces a subject with the show name and character', () => {
		const { subject } = composeReminder(DEFAULT_PARAMS);
		expect(subject).toContain('M*A*S*H');
		expect(subject).toContain('Hawkeye');
	});

	it('body includes the character greeting from the prompt', () => {
		const { body } = composeReminder(DEFAULT_PARAMS);
		expect(body).toContain('Well, hello there. Pull up a martini, soldier.');
	});

	it('body includes the air time', () => {
		const { body } = composeReminder(DEFAULT_PARAMS);
		expect(body).toContain('7:00 PM EST');
	});

	it('body includes the show name', () => {
		const { body } = composeReminder(DEFAULT_PARAMS);
		expect(body).toContain('M*A*S*H');
	});

	it('falls back to a generic greeting when prompt has no greeting field', () => {
		const params: ComposeReminderParams = {
			...DEFAULT_PARAMS,
			characterPrompt: 'Just a plain prompt with no greeting key.'
		};
		const { body } = composeReminder(params);
		expect(body).toContain("Hey there, it's Hawkeye.");
	});

	it('sets List-Unsubscribe header with mailto format', () => {
		const { headers } = composeReminder(DEFAULT_PARAMS);
		expect(headers['List-Unsubscribe']).toBe(
			'<mailto:unsub+0123456789abcdefghijklmnopqrstuv@bli.net>'
		);
	});

	it('does not advertise one-click unsubscribe without an HTTPS unsubscribe URL', () => {
		const { headers } = composeReminder(DEFAULT_PARAMS);
		expect(headers).not.toHaveProperty('List-Unsubscribe-Post');
	});
});

// ---------------------------------------------------------------------------
// HMAC tokens
// ---------------------------------------------------------------------------

describe('createEmailActionToken / signUnsubscribeAddress / extractUnsubscribeToken', () => {
	it('creates deterministic compact tokens for a payload and secret', async () => {
		const token = await createEmailActionToken('unsubscribe:viewer@example.com', TEST_SECRET);
		const repeated = await createEmailActionToken('unsubscribe:viewer@example.com', TEST_SECRET);

		expect(token).toBe(repeated);
		expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
	});

	it('changes tokens when the payload or secret changes', async () => {
		const token = await createEmailActionToken('unsubscribe:viewer@example.com', TEST_SECRET);
		const differentPayload = await createEmailActionToken(
			'confirm:viewer@example.com',
			TEST_SECRET
		);
		const differentSecret = await createEmailActionToken(
			'unsubscribe:viewer@example.com',
			'other-secret'
		);

		expect(differentPayload).not.toBe(token);
		expect(differentSecret).not.toBe(token);
	});

	it('signed address has a short SMTP-safe local part', async () => {
		const signed = await signUnsubscribeAddress('viewer@example.com', TEST_SECRET);
		const [localPart] = signed.split('@');

		expect(signed).toMatch(/^unsub\+[A-Za-z0-9_-]{32}@bli\.net$/);
		expect(localPart.length).toBeLessThanOrEqual(64);
		expect(signed).not.toContain('viewer@example.com');
	});

	it('extracts the unsubscribe token from a signed address', async () => {
		const signed = await signUnsubscribeAddress('viewer@example.com', TEST_SECRET);
		const expected = await createEmailActionToken('unsubscribe:viewer@example.com', TEST_SECRET);

		expect(extractUnsubscribeToken(signed)).toBe(expected);
	});

	it('rejects when the address has no unsub+ prefix', async () => {
		expect(extractUnsubscribeToken('bad+stuff@bli.net')).toBeNull();
	});

	it('rejects addresses outside the reminder domain', async () => {
		expect(
			extractUnsubscribeToken('unsub+0123456789abcdefghijklmnopqrstuv@example.com')
		).toBeNull();
		expect(extractUnsubscribeToken('unsub+0123456789abcdefghijklmnopqrstuv')).toBeNull();
	});

	it('rejects malformed tokens', async () => {
		expect(extractUnsubscribeToken('unsub+noseparator@bli.net')).toBeNull();
		expect(extractUnsubscribeToken('unsub+not-hex--payload@bli.net')).toBeNull();
	});

	it('rejects tokens with invalid characters', async () => {
		expect(extractUnsubscribeToken('unsub+0123456789abcdefghijklmnopqrstu/@bli.net')).toBeNull();
	});
});
