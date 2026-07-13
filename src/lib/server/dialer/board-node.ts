/// <reference types="@cloudflare/workers-types" />
/**
 * DialerBoardNode — one Durable Object per PUBLIC board (`idFromName(board)`).
 *
 * PR 1 skeleton: WebSocket presence via the Hibernation API, the caller
 * counter + last-caller (DO storage, deliberately NOT D1 — it's board-local
 * live state), and real-occupancy BUSY at 8 connected. Node chat and
 * connect-time accounting (the 45-minute budget flush to D1) land with the
 * app. Posts, files, scores, moderation, and cooldowns are never this class's
 * job — those are D1 rows behind plain routes.
 *
 * The socket route validates the session against D1 and forwards the upgrade
 * with the handle attached, so this class trusts X-Dialer-Handle.
 */
import { DurableObject } from 'cloudflare:workers';
import { BOARD_MAX_CALLERS } from './boards';

interface BoardNodeEnv {
	DIALER_DB: D1Database;
}

interface SocketAttachment {
	handle: string;
}

export interface BoardStatus {
	/** Lifetime caller count — "you are caller #1042". */
	callers: number;
	lastCaller: string | null;
	online: string[];
	busy: boolean;
}

export class DialerBoardNode extends DurableObject<BoardNodeEnv> {
	constructor(ctx: DurableObjectState, env: BoardNodeEnv) {
		super(ctx, env);
		// Hibernation-friendly keepalive: workerd answers pings without waking us.
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	/** WebSocket upgrade — presence. The route has already authenticated. */
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

		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1], [handle]);
		pair[1].serializeAttachment({ handle } satisfies SocketAttachment);
		await this.recordCall(handle);
		this.broadcast({ type: 'join', handle, online: this.online() });

		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	async webSocketMessage(): Promise<void> {
		// Node chat lands with the app; presence-only sockets have nothing to say.
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const { handle } = ws.deserializeAttachment() as SocketAttachment;
		this.broadcast({ type: 'leave', handle, online: this.online(ws) });
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

	/** Connected handles, optionally excluding a socket that is going away. */
	private online(except?: WebSocket): string[] {
		return this.ctx
			.getWebSockets()
			.filter((ws) => ws !== except)
			.map((ws) => (ws.deserializeAttachment() as SocketAttachment).handle);
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
}
