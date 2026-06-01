/// <reference types="@cloudflare/workers-types" />
import { Agent } from 'agents';
import { verifyUnsubscribeAddress } from './email-composer';

// ---------------------------------------------------------------------------
// Env — mirrors the bindings declared in wrangler.jsonc / app.d.ts
// ---------------------------------------------------------------------------

/* eslint-disable no-undef */
interface Env {
	KV: KVNamespace;
	REMINDER_AGENT: DurableObjectNamespace;
	SEND_EMAIL: SendEmail;
	ANTHROPIC_API_KEY: string;
	OPENAI_API_KEY?: string;
	EMAIL_SECRET: string;
	LLM_PROVIDER_ORDER?: string;
	ANTHROPIC_MODEL?: string;
	OPENAI_MODEL?: string;
	ANTHROPIC_MONTHLY_SPEND_CAP?: string;
	OPENAI_MONTHLY_SPEND_CAP?: string;
	RATE_LIMIT_PER_HOUR: string;
}

// ---------------------------------------------------------------------------
// ReminderAgent
// ---------------------------------------------------------------------------

export class ReminderAgent extends Agent<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql`
			CREATE TABLE IF NOT EXISTS subscribers (
				email             TEXT PRIMARY KEY,
				timezone          TEXT NOT NULL DEFAULT 'America/New_York',
				show_subscriptions TEXT NOT NULL DEFAULT '[]',
				created_at        TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`;
	}

	// -----------------------------------------------------------------------
	// Cron — fires daily at 08:00 UTC
	// -----------------------------------------------------------------------

	/**
	 * Initialise the daily cron schedule.
	 * Call once after the DO is created (e.g. from the subscribe endpoint on
	 * first subscription).
	 */
	async ensureCronScheduled(): Promise<void> {
		const existing = this.getSchedules({ type: 'cron' });
		if (existing.length === 0) {
			await this.schedule('0 8 * * *', 'onCron');
		}
	}

	/** Reminder delivery is dormant until #7 moves this DO to a separate Worker. */
	async onCron(): Promise<void> {
		console.warn(
			'ReminderAgent email delivery is dormant until #7 moves it to a separate Worker and migrates reminder lookup to Channel.schedule.'
		);
	}

	// -----------------------------------------------------------------------
	// Subscription management
	// -----------------------------------------------------------------------

	async subscribe(email: string, timezone: string, shows: string[]): Promise<void> {
		const showsJson = JSON.stringify(shows);
		this.sql`
			INSERT INTO subscribers (email, timezone, show_subscriptions)
			VALUES (${email}, ${timezone}, ${showsJson})
			ON CONFLICT(email) DO UPDATE SET
				timezone = ${timezone},
				show_subscriptions = ${showsJson}
		`;
		await this.ensureCronScheduled();
	}

	// -----------------------------------------------------------------------
	// Email-based unsubscribe (via HMAC-signed reply address)
	// -----------------------------------------------------------------------

	async onEmail(email: ForwardableEmailMessage): Promise<void> {
		const toAddr = email.to;
		const { valid, email: subscriberEmail } = await verifyUnsubscribeAddress(
			toAddr,
			this.env.EMAIL_SECRET
		);

		if (!valid) {
			email.setReject('Invalid unsubscribe signature');
			return;
		}

		this.sql`DELETE FROM subscribers WHERE email = ${subscriberEmail}`;
	}
}

export default ReminderAgent;
