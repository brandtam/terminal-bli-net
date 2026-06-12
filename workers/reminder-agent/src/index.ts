/// <reference types="@cloudflare/workers-types" />
import { getAgentByName } from 'agents';
import { ReminderAgent, type ReminderAgentEnv } from '../../../src/lib/server/reminder-agent';
import {
	SpendLedgerDO,
	type SpendLedgerDOEnv
} from '../../../src/lib/server/spend-ledger/do-ledger';
import { SPEND_LEDGER_ROUTES } from '../../../src/lib/server/spend-ledger/do-adapter';
import type { ReconcileInput, ReserveRequest } from '../../../src/lib/server/spend-ledger/types';

export { ReminderAgent, SpendLedgerDO };

const REMINDER_AGENT_INSTANCE = 'global';
// One global Spend Ledger instance is the whole point — it's the serialization
// point that makes the dollar ceilings exact (see docs/adr/0005).
const SPEND_LEDGER_INSTANCE = 'global';
const MAX_SUBSCRIPTIONS = 50;

export interface ReminderWorkerEnv extends ReminderAgentEnv, SpendLedgerDOEnv {
	REMINDER_AGENT: DurableObjectNamespace<ReminderAgent>;
	SPEND_LEDGER_DO: DurableObjectNamespace<SpendLedgerDO>;
}

export interface SubscribePayload {
	email: string;
	timezone: string;
	shows: string[];
}

type ReminderAgentStub = Pick<
	ReminderAgent,
	'subscribe' | 'confirmSubscription' | 'unsubscribeBySignedAddress'
>;
type ReminderAgentResolver = (env: ReminderWorkerEnv) => Promise<ReminderAgentStub>;

class ValidationError extends Error {}

function json(data: unknown, init?: ResponseInit): Response {
	return Response.json(data, {
		...init,
		headers: {
			'content-type': 'application/json',
			...init?.headers
		}
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateEmail(raw: unknown): string {
	if (typeof raw !== 'string') {
		throw new ValidationError('email is required');
	}
	const email = raw.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new ValidationError('email is invalid');
	}
	return email;
}

function validateTimezone(raw: unknown): string {
	if (typeof raw !== 'string' || raw.trim() === '') {
		throw new ValidationError('timezone is required');
	}
	const timezone = raw.trim();
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
	} catch {
		throw new ValidationError(`timezone "${timezone}" is invalid`);
	}
	return timezone;
}

function validateShows(raw: unknown): string[] {
	if (!Array.isArray(raw)) {
		throw new ValidationError('shows must be an array');
	}
	const shows = raw.map((show) => (typeof show === 'string' ? show.trim() : '')).filter(Boolean);
	if (shows.length === 0) {
		throw new ValidationError('shows must include at least one show');
	}
	if (shows.length > MAX_SUBSCRIPTIONS) {
		throw new ValidationError(`shows exceeds max of ${MAX_SUBSCRIPTIONS}`);
	}
	return [...new Set(shows)];
}

export function parseSubscribePayload(raw: unknown): SubscribePayload {
	if (!isRecord(raw)) {
		throw new ValidationError('Request body must be a JSON object');
	}
	return {
		email: validateEmail(raw.email),
		timezone: validateTimezone(raw.timezone),
		shows: validateShows(raw.shows)
	};
}

async function parseJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ValidationError('Invalid JSON body');
	}
}

async function resolveReminderAgent(env: ReminderWorkerEnv): Promise<ReminderAgentStub> {
	return getAgentByName<ReminderWorkerEnv, ReminderAgent>(
		env.REMINDER_AGENT,
		REMINDER_AGENT_INSTANCE
	);
}

export async function handleSubscribe(
	request: Request,
	env: ReminderWorkerEnv,
	resolveAgent: ReminderAgentResolver = resolveReminderAgent
): Promise<Response> {
	if (request.method !== 'POST') {
		return json({ error: 'Method not allowed' }, { status: 405 });
	}

	let payload: SubscribePayload;
	try {
		payload = parseSubscribePayload(await parseJson(request));
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Invalid subscription request';
		return json({ error: message }, { status: 400 });
	}

	try {
		const agent = await resolveAgent(env);
		await agent.subscribe(payload.email, payload.timezone, payload.shows);
		return json({ ok: true, status: 'pending' });
	} catch (err) {
		console.error('[reminder-worker] subscribe failed', err);
		return json({ error: 'Reminder service failed' }, { status: 500 });
	}
}

export async function handleConfirm(
	request: Request,
	env: ReminderWorkerEnv,
	resolveAgent: ReminderAgentResolver = resolveReminderAgent
): Promise<Response> {
	if (request.method !== 'GET' && request.method !== 'POST') {
		return json({ error: 'Method not allowed' }, { status: 405 });
	}

	const token = new URL(request.url).searchParams.get('token') ?? '';
	if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
		return json({ error: 'confirmation token is invalid' }, { status: 400 });
	}

	try {
		const agent = await resolveAgent(env);
		const confirmed = await agent.confirmSubscription(token);
		if (!confirmed) {
			return json({ error: 'confirmation token not found' }, { status: 404 });
		}
		return json({ ok: true, status: 'active' });
	} catch (err) {
		console.error('[reminder-worker] confirmation failed', err);
		return json({ error: 'Reminder service failed' }, { status: 500 });
	}
}

export async function handleEmail(
	message: ForwardableEmailMessage,
	env: ReminderWorkerEnv,
	resolveAgent: ReminderAgentResolver = resolveReminderAgent
): Promise<void> {
	const agent = await resolveAgent(env);
	const unsubscribed = await agent.unsubscribeBySignedAddress(message.to);
	if (!unsubscribed) {
		message.setReject('Invalid unsubscribe signature');
	}
}

// ---------------------------------------------------------------------------
// Spend Ledger RPC — the Pages app reaches the global ledger through these
// endpoints over its SPEND_LEDGER service binding. Each request is forwarded to
// the single global SpendLedgerDO instance, where the exact accounting lives.
// ---------------------------------------------------------------------------

interface LedgerCallBody {
	req?: unknown;
	reservationId?: unknown;
	actual?: unknown;
	nowMs?: unknown;
}

function ledgerStub(env: ReminderWorkerEnv) {
	return env.SPEND_LEDGER_DO.get(env.SPEND_LEDGER_DO.idFromName(SPEND_LEDGER_INSTANCE));
}

export async function handleLedger(request: Request, env: ReminderWorkerEnv): Promise<Response> {
	if (request.method !== 'POST') {
		return json({ error: 'Method not allowed' }, { status: 405 });
	}

	let body: LedgerCallBody;
	try {
		body = (await request.json()) as LedgerCallBody;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const nowMs = typeof body.nowMs === 'number' ? body.nowMs : Date.now();
	const path = new URL(request.url).pathname;
	const stub = ledgerStub(env);

	try {
		switch (path) {
			case SPEND_LEDGER_ROUTES.reserve:
				return json(await stub.reserve(body.req as ReserveRequest, nowMs));
			case SPEND_LEDGER_ROUTES.reconcile:
				await stub.reconcile(String(body.reservationId), body.actual as ReconcileInput, nowMs);
				return json({ ok: true });
			case SPEND_LEDGER_ROUTES.release:
				await stub.release(String(body.reservationId), nowMs);
				return json({ ok: true });
			case SPEND_LEDGER_ROUTES.status:
				return json(await stub.status(nowMs));
			default:
				return json({ error: 'Not found' }, { status: 404 });
		}
	} catch (err) {
		console.error('[reminder-worker] spend ledger call failed', err);
		return json({ error: 'Spend ledger failed' }, { status: 500 });
	}
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/health') {
			return json({ ok: true });
		}

		if (url.pathname === '/subscribe') {
			return handleSubscribe(request, env);
		}

		if (url.pathname === '/confirm') {
			return handleConfirm(request, env);
		}

		if (url.pathname.startsWith('/ledger/')) {
			return handleLedger(request, env);
		}

		return json({ error: 'Not found' }, { status: 404 });
	},

	async email(message, env) {
		await handleEmail(message, env);
	}
} satisfies ExportedHandler<ReminderWorkerEnv>;
