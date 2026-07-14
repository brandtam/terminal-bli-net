/// <reference types="@cloudflare/workers-types" />
import { Agent } from 'agents';
import {
	createEmailActionToken,
	composeReminder,
	extractUnsubscribeToken,
	signUnsubscribeAddress
} from './email-composer';
import { buildReminderCandidates, type ReminderSubscriber } from './reminder-delivery';
import type { PublicContentCatalog } from './content-catalog';

// ---------------------------------------------------------------------------
// Env — mirrors the bindings declared in wrangler.jsonc / app.d.ts
// ---------------------------------------------------------------------------

// A confirmation email is sent at most once per address per this window, so the
// endpoint can't be turned into a mail-bomb against a victim via rotating IPs.
const CONFIRM_RESEND_THROTTLE_SECONDS = 300;
// Unclicked confirmation links expire after this many days.
const CONFIRM_TOKEN_TTL_DAYS = 7;
// Cap the catalog fetch so a hung upstream can't stall the cron alarm.
const CATALOG_FETCH_TIMEOUT_MS = 10_000;

export interface ReminderAgentEnv {
	SEND_EMAIL: SendEmail;
	EMAIL_SECRET: string;
	REMINDER_FROM_EMAIL?: string;
	REMINDER_FROM_NAME?: string;
	REMINDER_CONTENT_URL?: string;
	REMINDER_CONFIRM_URL?: string;
	REMINDER_LEAD_MINUTES?: string;
}

interface SubscriberRow {
	email: string;
	timezone: string;
	show_subscriptions: string;
	status: 'pending' | 'active';
	unsubscribe_token: string;
	confirmation_token: string;
}

// ---------------------------------------------------------------------------
// ReminderAgent
// ---------------------------------------------------------------------------

export class ReminderAgent extends Agent<ReminderAgentEnv> {
	constructor(ctx: DurableObjectState, env: ReminderAgentEnv) {
		super(ctx, env);
		// `timezone` / `show_subscriptions` are the live, confirmed values served to
		// the cron. Edits land in `pending_timezone` / `pending_shows` and only
		// replace the live values once the new confirmation link is clicked — so an
		// active subscriber keeps receiving reminders (and can't be knocked offline
		// by someone re-submitting their address) until they confirm the change.
		this.sql`
			CREATE TABLE IF NOT EXISTS subscribers (
				email             TEXT PRIMARY KEY,
				timezone          TEXT NOT NULL DEFAULT 'America/New_York',
				show_subscriptions TEXT NOT NULL DEFAULT '[]',
				status            TEXT NOT NULL DEFAULT 'pending',
				unsubscribe_token TEXT NOT NULL DEFAULT '',
				confirmation_token TEXT NOT NULL DEFAULT '',
				confirmation_sent_at TEXT,
				pending_timezone  TEXT,
				pending_shows     TEXT,
				created_at        TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`;
		this.sql`
			CREATE TABLE IF NOT EXISTS sent_reminders (
				email      TEXT NOT NULL,
				slot_key   TEXT NOT NULL,
				show_slug  TEXT NOT NULL,
				sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY (email, slot_key)
			)
		`;
	}

	// -----------------------------------------------------------------------
	// Cron — scans every 15 minutes for upcoming subscribed shows
	// -----------------------------------------------------------------------

	/**
	 * Initialise the daily cron schedule.
	 * Call once after the DO is created (e.g. from the subscribe endpoint on
	 * first subscription).
	 */
	async ensureCronScheduled(): Promise<void> {
		const existing = this.getSchedules({ type: 'cron' });
		if (existing.length === 0) {
			await this.schedule('*/15 * * * *', 'onCron');
		}
	}

	async onCron(): Promise<void> {
		await this.deliverDueReminders(new Date());
	}

	// -----------------------------------------------------------------------
	// Subscription management
	// -----------------------------------------------------------------------

	async subscribe(email: string, timezone: string, shows: string[]): Promise<void> {
		const secret = this.requireEmailSecret();
		const showsJson = JSON.stringify(shows);

		// Per-email confirmation throttle. The route already rate-limits per IP, but
		// that's bypassable with rotating IPs — this caps confirmation emails to one
		// per address per window so the endpoint can't be used to mail-bomb a victim.
		const throttled = this.sql`
			SELECT 1 FROM subscribers
			WHERE email = ${email}
				AND confirmation_sent_at IS NOT NULL
				AND confirmation_sent_at > datetime('now', ${`-${CONFIRM_RESEND_THROTTLE_SECONDS} seconds`})
			LIMIT 1
		`;
		if (throttled.length > 0) return;

		const unsubscribeToken = await createEmailActionToken(`unsubscribe:${email}`, secret);
		const confirmationToken = await createEmailActionToken(
			`confirm:${email}:${timezone}:${showsJson}`,
			secret
		);

		// On conflict we touch only the pending columns + confirmation fields. The
		// live status/timezone/show_subscriptions are left as-is so an existing
		// active subscriber keeps getting reminders until they confirm the change.
		this.sql`
			INSERT INTO subscribers (
				email,
				status,
				unsubscribe_token,
				confirmation_token,
				confirmation_sent_at,
				pending_timezone,
				pending_shows
			)
			VALUES (${email}, 'pending', ${unsubscribeToken}, ${confirmationToken}, datetime('now'), ${timezone}, ${showsJson})
			ON CONFLICT(email) DO UPDATE SET
				confirmation_token = ${confirmationToken},
				confirmation_sent_at = datetime('now'),
				pending_timezone = ${timezone},
				pending_shows = ${showsJson}
		`;
		await this.sendConfirmationEmail(email, confirmationToken);
		await this.ensureCronScheduled();
	}

	async confirmSubscription(token: string): Promise<boolean> {
		if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return false;

		// Promote the pending edit to live and activate. Clearing confirmation_token
		// makes the link single-use (no replay), and the date guard expires links
		// that were never clicked. COALESCE keeps the live values if a row somehow
		// has no pending edit (e.g. an already-active confirm).
		const updated = this.sql<{ email: string }>`
			UPDATE subscribers
			SET status = 'active',
				timezone = COALESCE(pending_timezone, timezone),
				show_subscriptions = COALESCE(pending_shows, show_subscriptions),
				pending_timezone = NULL,
				pending_shows = NULL,
				confirmation_token = ''
			WHERE confirmation_token = ${token}
				AND confirmation_sent_at > datetime('now', ${`-${CONFIRM_TOKEN_TTL_DAYS} days`})
			RETURNING email
		`;
		if (updated.length > 0) {
			await this.ensureCronScheduled();
			return true;
		}
		return false;
	}

	async deliverDueReminders(now: Date): Promise<number> {
		const catalog = await this.loadCatalog();
		const leadMinutes = this.resolveLeadMinutes();
		const subscribers = this.loadSubscribers();
		const candidates = buildReminderCandidates(catalog, subscribers, now, leadMinutes);
		let sent = 0;

		for (const candidate of candidates) {
			if (this.hasSentReminder(candidate.email, candidate.slotKey)) continue;

			try {
				const signedReplyAddr = await signUnsubscribeAddress(
					candidate.email,
					this.requireEmailSecret()
				);
				const reminder = composeReminder({
					showName: candidate.showName,
					characterName: candidate.characterName,
					characterPrompt: `greeting": ${JSON.stringify(candidate.characterGreeting)}`,
					signedReplyAddr,
					nextAirTime: candidate.nextAirTime
				});

				await this.env.SEND_EMAIL.send({
					from: this.fromAddress(),
					to: candidate.email,
					replyTo: signedReplyAddr,
					subject: reminder.subject,
					text: reminder.body,
					headers: reminder.headers
				});

				this.markReminderSent(candidate.email, candidate.slotKey, candidate.showSlug);
				sent++;
			} catch (err) {
				console.error('[ReminderAgent] reminder delivery failed', {
					showSlug: candidate.showSlug,
					slotKey: candidate.slotKey,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}

		return sent;
	}

	private resolveLeadMinutes(): number {
		const raw = this.env.REMINDER_LEAD_MINUTES;
		if (!raw) return 30;
		const leadMinutes = Number(raw);
		return Number.isFinite(leadMinutes) && leadMinutes >= 0 ? leadMinutes : 30;
	}

	private loadSubscribers(): ReminderSubscriber[] {
		return this.sql<SubscriberRow>`
			SELECT email, timezone, show_subscriptions, status, unsubscribe_token, confirmation_token
			FROM subscribers
			WHERE status = 'active'
		`.map((row) => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(row.show_subscriptions) as unknown;
			} catch {
				parsed = [];
			}
			const showSubscriptions = Array.isArray(parsed)
				? parsed.filter((show): show is string => typeof show === 'string')
				: [];

			return {
				email: row.email,
				timezone: row.timezone,
				showSubscriptions
			};
		});
	}

	private async loadCatalog(): Promise<PublicContentCatalog> {
		const contentUrl = this.env.REMINDER_CONTENT_URL ?? 'https://bli.net/api/data';
		const response = await fetch(contentUrl, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS)
		});
		if (!response.ok) {
			throw new Error(`Reminder content fetch failed with ${response.status}`);
		}
		return (await response.json()) as PublicContentCatalog;
	}

	private hasSentReminder(email: string, slotKey: string): boolean {
		return (
			this.sql`
				SELECT 1 FROM sent_reminders
				WHERE email = ${email} AND slot_key = ${slotKey}
				LIMIT 1
			`.length > 0
		);
	}

	private markReminderSent(email: string, slotKey: string, showSlug: string): void {
		this.sql`
			INSERT OR IGNORE INTO sent_reminders (email, slot_key, show_slug)
			VALUES (${email}, ${slotKey}, ${showSlug})
		`;
	}

	private requireEmailSecret(): string {
		if (!this.env.EMAIL_SECRET) {
			throw new Error('EMAIL_SECRET is not configured');
		}
		return this.env.EMAIL_SECRET;
	}

	private fromAddress(): EmailAddress {
		return {
			email: this.env.REMINDER_FROM_EMAIL ?? 'reminders@bli.net',
			name: this.env.REMINDER_FROM_NAME ?? 'Terminal Bli Net'
		};
	}

	private async sendConfirmationEmail(email: string, token: string): Promise<void> {
		const confirmUrl = new URL(
			this.env.REMINDER_CONFIRM_URL ?? 'https://bli.net/api/subscribe/confirm'
		);
		confirmUrl.searchParams.set('token', token);

		await this.env.SEND_EMAIL.send({
			from: this.fromAddress(),
			to: email,
			subject: 'Confirm Terminal Bli Net reminders',
			text: [
				'Confirm your Terminal Bli Net reminders:',
				'',
				confirmUrl.toString(),
				'',
				'If you did not request this, ignore this email.'
			].join('\n')
		});
	}

	// -----------------------------------------------------------------------
	// Email-based unsubscribe (via HMAC-signed reply address)
	// -----------------------------------------------------------------------

	async onEmail(email: ForwardableEmailMessage): Promise<void> {
		const unsubscribed = await this.unsubscribeBySignedAddress(email.to);
		if (!unsubscribed) {
			email.setReject('Invalid unsubscribe signature');
		}
	}

	async unsubscribeBySignedAddress(toAddr: string): Promise<boolean> {
		const token = extractUnsubscribeToken(toAddr);
		if (!token) return false;

		const deleted = this.sql<{ email: string }>`
			DELETE FROM subscribers
			WHERE unsubscribe_token = ${token}
			RETURNING email
		`;
		return deleted.length > 0;
	}
}

export default ReminderAgent;
