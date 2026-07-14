/// <reference types="@cloudflare/workers-types" />
/**
 * DialerBoardNode — one Durable Object per PUBLIC board (`idFromName(board)`).
 *
 * Owns the board's live layer: WebSocket presence via the Hibernation API,
 * ephemeral node chat (history dies with the socket, like a real node), the
 * caller counter + last-caller (DO storage, deliberately NOT D1 — board-local
 * live state), real-occupancy BUSY at 8 connected, and connect-time
 * accounting for the 45-minute daily budget — warnings at 10 and 1 minutes,
 * TIME'S UP drops carrier, used minutes flush to D1 so the budget survives
 * redials. Posts, files, scores, moderation, and cooldowns are never this
 * class's job — those are D1 rows behind plain routes.
 *
 * The socket route validates the session against D1 and forwards the upgrade
 * with the handle attached, so this class trusts X-Dialer-Handle.
 */
import { DurableObject } from 'cloudflare:workers';
import { BOARD_MAX_CALLERS, DAILY_MINUTES_BUDGET, TIME_WARNINGS } from './boards';

interface BoardNodeEnv {
	DIALER_DB: D1Database;
}

interface SocketAttachment {
	handle: string;
	/** Connect wall-clock ms; elapsed time on this socket derives from it. */
	connectedAt: number;
	/** callers.minutes_today at connect — this socket's budget starts above it. */
	baseMinutes: number;
	/** Whole minutes of this session already flushed to D1 (idempotent flush). */
	flushedMinutes: number;
	/** Remaining-minute warnings already sent, so none repeats. */
	warned: number[];
}

/** Minimum gap between chat lines per socket — a modem, not a firehose. */
const CHAT_COOLDOWN_MS = 1_000;
const CHAT_MAX_CHARS = 200;
/** The budget check cadence while anyone is connected. */
const TICK_MS = 30_000;

export interface BoardStatus {
	/** Lifetime caller count — "you are caller #1042". */
	callers: number;
	lastCaller: string | null;
	online: string[];
	busy: boolean;
}

export class DialerBoardNode extends DurableObject<BoardNodeEnv> {
	/** Last chat line per live socket. In-memory on purpose: lost on hibernation, worst case a free extra line. */
	private lastChatAt = new Map<WebSocket, number>();

	constructor(ctx: DurableObjectState, env: BoardNodeEnv) {
		super(ctx, env);
		// Hibernation-friendly keepalive: workerd answers pings without waking us.
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	/** WebSocket upgrade — presence + time budget. The route has already authenticated. */
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return new Response('EXPECTED WEBSOCKET', { status: 426 });
		}
		const handle = request.headers.get('X-Dialer-Handle');
		if (!handle) return new Response('NO CARRIER', { status: 401 });
		if (this.ctx.getWebSockets().length >= BOARD_MAX_CALLERS) {
			// Real occupancy; the client layers ~5% random BUSY on top for flavor.
			return new Response('BUSY', { status: 503 });
		}

		const baseMinutes = await this.minutesToday(handle);
		if (baseMinutes >= DAILY_MINUTES_BUDGET) {
			return new Response("TIME'S UP -- CALL BACK TOMORROW", { status: 403 });
		}

		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1], [handle]);
		pair[1].serializeAttachment({
			handle,
			connectedAt: Date.now(),
			baseMinutes,
			flushedMinutes: 0,
			warned: []
		} satisfies SocketAttachment);
		await this.recordCall(handle);
		this.broadcast({ type: 'join', handle, online: this.online() });
		this.send(pair[1], { type: 'time', remaining: DAILY_MINUTES_BUDGET - baseMinutes });
		await this.armAlarm();

		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	/** Node chat — ephemeral, broadcast-only, zero storage (PRD §5). */
	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(message);
		} catch {
			return;
		}
		if (typeof parsed !== 'object' || parsed === null) return;
		const { type, text } = parsed as { type?: unknown; text?: unknown };

		if (type === 'who') {
			this.send(ws, { type: 'who', online: this.online() });
			return;
		}
		if (type !== 'chat' || typeof text !== 'string') return;

		const now = Date.now();
		if (now - (this.lastChatAt.get(ws) ?? 0) < CHAT_COOLDOWN_MS) return;

		const line = cleanChatLine(text);
		if (!line) return;
		this.lastChatAt.set(ws, now);
		const { handle } = ws.deserializeAttachment() as SocketAttachment;
		this.broadcast({ type: 'chat', handle, text: line });
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const attachment = ws.deserializeAttachment() as SocketAttachment;
		this.lastChatAt.delete(ws);
		await this.flushMinutes(ws, attachment, true);
		this.broadcast({ type: 'leave', handle: attachment.handle, online: this.online(ws) });
	}

	/**
	 * The budget tick: flush used minutes, warn at the marks, drop carrier at
	 * zero. Re-arms itself while anyone is still connected.
	 */
	async alarm(): Promise<void> {
		for (const ws of this.ctx.getWebSockets()) {
			const attachment = ws.deserializeAttachment() as SocketAttachment;
			const remaining = await this.flushMinutes(ws, attachment, false);
			if (remaining <= 0) {
				this.send(ws, { type: 'time', remaining: 0 });
				ws.close(1000, "TIME'S UP");
				continue;
			}
			for (const mark of TIME_WARNINGS) {
				if (remaining <= mark && !attachment.warned.includes(mark)) {
					attachment.warned.push(mark);
					ws.serializeAttachment(attachment);
					this.send(ws, { type: 'time', remaining });
				}
			}
		}
		await this.armAlarm();
	}

	/** RPC for the status route: counter, last caller, who's online, busy. */
	async status(): Promise<BoardStatus> {
		const [callers, lastCaller] = await Promise.all([
			this.ctx.storage.get<number>('calls'),
			this.ctx.storage.get<string>('lastCaller')
		]);
		const online = this.online();
		return {
			callers: callers ?? 0,
			lastCaller: lastCaller ?? null,
			online,
			busy: online.length >= BOARD_MAX_CALLERS
		};
	}

	/** Bump the lifetime caller counter and remember the caller. */
	async recordCall(handle: string): Promise<number> {
		const calls = ((await this.ctx.storage.get<number>('calls')) ?? 0) + 1;
		// One put for both keys — a single atomic write.
		await this.ctx.storage.put({ calls, lastCaller: handle });
		return calls;
	}

	/**
	 * Write this socket's unflushed connect time to D1 and return the minutes
	 * the caller has left. Ticks flush whole elapsed minutes; the closing flush
	 * rounds up so ten 30-second calls can't be free.
	 */
	private async flushMinutes(
		ws: WebSocket,
		attachment: SocketAttachment,
		closing: boolean
	): Promise<number> {
		const elapsedMs = Date.now() - attachment.connectedAt;
		const sessionMinutes = closing ? Math.ceil(elapsedMs / 60_000) : Math.floor(elapsedMs / 60_000);
		const delta = sessionMinutes - attachment.flushedMinutes;
		if (delta > 0) {
			try {
				await this.env.DIALER_DB.prepare(
					'UPDATE callers SET minutes_today = minutes_today + ?2, last_seen = ?3 WHERE handle = ?1'
				)
					.bind(attachment.handle, delta, Math.floor(Date.now() / 1000))
					.run();
				attachment.flushedMinutes = sessionMinutes;
				if (!closing) ws.serializeAttachment(attachment);
			} catch (err) {
				// D1 hiccup: keep the socket alive, try again next tick.
				console.error('[dialer node] minutes flush failed', err);
			}
		}
		return DAILY_MINUTES_BUDGET - attachment.baseMinutes - sessionMinutes;
	}

	/** Keep one alarm ticking while any socket is connected. */
	private async armAlarm(): Promise<void> {
		if (this.ctx.getWebSockets().length === 0) return;
		const current = await this.ctx.storage.getAlarm();
		if (current === null) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
	}

	/** Connected handles, optionally excluding a socket that is going away. */
	private online(except?: WebSocket): string[] {
		return this.ctx
			.getWebSockets()
			.filter((ws) => ws !== except)
			.map((ws) => (ws.deserializeAttachment() as SocketAttachment).handle);
	}

	private send(ws: WebSocket, payload: Record<string, unknown>): void {
		try {
			ws.send(JSON.stringify(payload));
		} catch {
			// a socket mid-close; its loss is not news
		}
	}

	private broadcast(payload: Record<string, unknown>): void {
		const message = JSON.stringify(payload);
		for (const ws of this.ctx.getWebSockets()) {
			// A socket mid-close still appears here briefly; its loss is not news.
			try {
				ws.send(message);
			} catch {
				// ignore
			}
		}
	}

	/** How many minutes this handle has already burned today, straight from D1. */
	private async minutesToday(handle: string): Promise<number> {
		const row = await this.env.DIALER_DB.prepare(
			'SELECT minutes_today FROM callers WHERE handle = ?1'
		)
			.bind(handle)
			.first<{ minutes_today: number }>();
		return row?.minutes_today ?? 0;
	}
}

/** One chat line: control characters out, whitespace collapsed, era-length cap. */
function cleanChatLine(raw: string): string {
	return (
		raw
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, CHAT_MAX_CHARS)
	);
}
