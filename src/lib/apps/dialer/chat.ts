/**
 * The board node's WebSocket client: presence, node chat, and the time
 * budget, all pushed from the DialerBoardNode. The window owns one of these
 * per live call and forwards the events into the machine as `chat`,
 * `presence`, and `time` responses.
 *
 * Kept dumb on purpose — no reconnect, no backfill. A dropped node is a
 * dropped node (chat is ephemeral by design); the caller redials. Failure to
 * connect at all is silent: presence and chat simply never populate, and the
 * board still reads and posts over plain HTTP.
 */

export type NodeEvent =
	| { type: 'chat'; handle: string; text: string }
	| { type: 'presence'; online: string[] }
	| { type: 'time'; remaining: number };

export interface NodeConnection {
	send(text: string): void;
	who(): void;
	close(): void;
}

type Incoming =
	| { type: 'join'; handle: string; online: string[] }
	| { type: 'leave'; handle: string; online: string[] }
	| { type: 'who'; online: string[] }
	| { type: 'chat'; handle: string; text: string }
	| { type: 'time'; remaining: number };

/**
 * Open the node socket for a board. `onEvent` fires for every presence, chat,
 * and time update; `onClose` fires once when the socket goes away (the window
 * treats it as a dropped node). Returns a handle for sending chat and leaving.
 */
export function connectNode(
	board: string,
	token: string,
	onEvent: (event: NodeEvent) => void,
	onClose: () => void
): NodeConnection {
	const url = `${wsBase()}/api/dialer/boards/${board}/socket?token=${encodeURIComponent(token)}`;
	let socket: WebSocket | null = null;
	try {
		socket = new WebSocket(url);
	} catch {
		// A malformed URL or blocked scheme — behave as a node that never answered.
		queueMicrotask(onClose);
		return { send: () => {}, who: () => {}, close: () => {} };
	}

	socket.addEventListener('message', (event) => {
		let data: Incoming;
		try {
			data = JSON.parse(event.data as string);
		} catch {
			return;
		}
		if (data.type === 'chat') {
			onEvent({ type: 'chat', handle: data.handle, text: data.text });
		} else if (data.type === 'time') {
			onEvent({ type: 'time', remaining: data.remaining });
		} else if ('online' in data) {
			onEvent({ type: 'presence', online: data.online });
		}
	});
	socket.addEventListener('close', onClose);
	socket.addEventListener('error', () => socket?.close());

	return {
		send(text: string) {
			trySend(socket, { type: 'chat', text });
		},
		who() {
			trySend(socket, { type: 'who' });
		},
		close() {
			try {
				socket?.close();
			} catch {
				// already gone
			}
		}
	};
}

function trySend(socket: WebSocket | null, payload: Record<string, unknown>): void {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(payload));
	}
}

/** ws:// or wss:// to match the page origin. */
function wsBase(): string {
	const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${scheme}//${window.location.host}`;
}
