/// <reference types="@cloudflare/workers-types" />
import { Agent } from 'agents';
import {
	composeReminder,
	signUnsubscribeAddress,
	verifyUnsubscribeAddress
} from './email-composer';
import { loadBots, loadGroups } from './bots';

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
// Subscriber row shape
// ---------------------------------------------------------------------------

interface SubscriberRow {
	email: string;
	timezone: string;
	show_subscriptions: string; // JSON array of group slugs
	created_at: string;
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

	/**
	 * Daily cron handler — find subscribers whose shows air in the next 12 h,
	 * compose an in-voice email for each, and send.
	 */
	async onCron(): Promise<void> {
		const now = new Date();
		const subscribers = this.sql<SubscriberRow>`SELECT * FROM subscribers`;

		const groups = loadGroups();

		for (const sub of subscribers) {
			const showSlugs: string[] = JSON.parse(sub.show_subscriptions);

			for (const slug of showSlugs) {
				const group = groups.find((g) => g.slug === slug);
				if (!group) continue;

				// Check whether any slot for this show starts within the next 12 h
				const upcoming = isShowUpcomingWithin(group.schedule ?? [], now, 12);
				if (!upcoming) continue;

				// Pick the first bot in the group to speak in-voice
				const bots = loadBots().filter((b) => b.group === slug);
				const bot = bots[0];
				if (!bot) continue;

				const signedReplyAddr = await signUnsubscribeAddress(sub.email, this.env.EMAIL_SECRET);

				const { subject, body, headers } = composeReminder({
					showName: group.name,
					characterName: bot.name,
					characterPrompt: bot.prompt,
					recipientEmail: sub.email,
					signedReplyAddr,
					nextAirTime: upcoming.startFormatted
				});

				// TODO: Replace with real send once Email Routing is configured
				try {
					await this.env.SEND_EMAIL.send({
						from: `${bot.name} <reminders@bli.net>`,
						to: sub.email,
						subject,
						text: body,
						headers
					});
				} catch (err) {
					console.error(`Failed to send reminder to ${sub.email}:`, err);
				}
			}
		}
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

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6
};

interface UpcomingSlot {
	startFormatted: string;
}

/**
 * Returns info about the next upcoming slot within `withinHours` hours, or
 * `null` if no slot qualifies.
 */
function isShowUpcomingWithin(
	schedule: { day: string; start: string; duration: number }[],
	now: Date,
	withinHours: number
): UpcomingSlot | null {
	const currentDay = now.getUTCDay();
	const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	const windowMinutes = withinHours * 60;

	for (const slot of schedule) {
		const slotDay = DAY_MAP[slot.day];
		if (slotDay === undefined) continue;

		const [h, m] = slot.start.split(':').map(Number);
		const slotMinutes = h * 60 + m;

		// Calculate minutes until this slot from now (within the same week)
		let dayDiff = slotDay - currentDay;
		if (dayDiff < 0) dayDiff += 7;

		const minutesUntil = dayDiff * 24 * 60 + (slotMinutes - currentMinutes);

		if (minutesUntil >= 0 && minutesUntil <= windowMinutes) {
			const startDate = new Date(now);
			startDate.setUTCDate(startDate.getUTCDate() + dayDiff);
			startDate.setUTCHours(h, m, 0, 0);

			const startFormatted = startDate.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				timeZone: 'UTC'
			});

			return { startFormatted };
		}
	}

	return null;
}

export default ReminderAgent;
