/// <reference types="@cloudflare/workers-types" />
import { describe, it, expect } from 'vitest';
import {
	composeReminder,
	signUnsubscribeAddress,
	verifyUnsubscribeAddress,
	type ComposeReminderParams
} from './email-composer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-hmac-secret-key-1234';

const DEFAULT_PARAMS: ComposeReminderParams = {
	showName: 'M*A*S*H',
	characterName: 'Hawkeye',
	characterPrompt:
		'greeting": "Well, hello there. Pull up a martini, soldier." voice: sardonic',
	recipientEmail: 'fan@example.com',
	signedReplyAddr: 'unsub+abc123--fan@example.com@bli.net',
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
			'<mailto:unsub+abc123--fan@example.com@bli.net>'
		);
	});

	it('sets List-Unsubscribe-Post header for one-click unsubscribe', () => {
		const { headers } = composeReminder(DEFAULT_PARAMS);
		expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
	});
});

// ---------------------------------------------------------------------------
// HMAC sign / verify round-trip
// ---------------------------------------------------------------------------

describe('signUnsubscribeAddress / verifyUnsubscribeAddress', () => {
	it('round-trips: sign then verify returns valid with correct email', async () => {
		const email = 'viewer@example.com';
		const signed = await signUnsubscribeAddress(email, TEST_SECRET);
		const result = await verifyUnsubscribeAddress(signed, TEST_SECRET);

		expect(result.valid).toBe(true);
		expect(result.email).toBe(email);
	});

	it('signed address has the expected format', async () => {
		const signed = await signUnsubscribeAddress('a@b.com', TEST_SECRET);
		expect(signed).toMatch(/^unsub\+[0-9a-f]+--a@b\.com@bli\.net$/);
	});

	it('rejects when the signature is tampered with', async () => {
		const email = 'viewer@example.com';
		const signed = await signUnsubscribeAddress(email, TEST_SECRET);
		// Flip a hex digit in the signature
		const tampered = signed.replace(/^(unsub\+)([0-9a-f])/, (_, prefix, first) => {
			const flipped = first === '0' ? '1' : '0';
			return prefix + flipped;
		});
		const result = await verifyUnsubscribeAddress(tampered, TEST_SECRET);
		expect(result.valid).toBe(false);
	});

	it('rejects when the secret is different', async () => {
		const email = 'viewer@example.com';
		const signed = await signUnsubscribeAddress(email, TEST_SECRET);
		const result = await verifyUnsubscribeAddress(signed, 'wrong-secret');
		expect(result.valid).toBe(false);
	});

	it('rejects when the address has no unsub+ prefix', async () => {
		const result = await verifyUnsubscribeAddress('bad+stuff@bli.net', TEST_SECRET);
		expect(result.valid).toBe(false);
		expect(result.email).toBe('');
	});

	it('rejects when the address has no separator', async () => {
		const result = await verifyUnsubscribeAddress('unsub+noseparator@bli.net', TEST_SECRET);
		expect(result.valid).toBe(false);
		expect(result.email).toBe('');
	});
});
