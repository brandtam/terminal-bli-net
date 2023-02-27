declare module 'sse.js' {
	export type SSEOptions = EventSourceInit & {
		headers?: Record<string, string>;
		payload?: string;
		method?: string;
	};

	export class SSE extends EventSource {
		constructor(url: string, options?: SSEOptions);
		stream(): Promise<void>;
	}
}
