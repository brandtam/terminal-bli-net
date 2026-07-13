/**
 * Browser-side Turnstile helper for the chat widget.
 *
 * Lazy-loads Cloudflare's Turnstile script the first time a token is needed, so
 * the third-party script is never pulled in when Turnstile is unconfigured (dev)
 * or before the visitor actually chats. `getTurnstileToken()` renders a one-shot
 * widget, resolves with its token, and tears it down — no long-lived widget
 * state to manage. The matching server gate lives in `lib/server/turnstile.ts`.
 *
 * The site key is passed in (read once from `$env/dynamic/public` at the app
 * edge in `routes/+page.svelte` and threaded through the app context), so this
 * module stays a pure, env-free leaf — easy to test, with no virtual-module
 * import in the unit graph.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

interface TurnstileRenderOptions {
	sitekey: string;
	callback: (token: string) => void;
	'error-callback'?: () => void;
	'timeout-callback'?: () => void;
}

interface TurnstileApi {
	render(el: HTMLElement, options: TurnstileRenderOptions): string;
	remove(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let scriptPromise: Promise<void> | null = null;

/** A script fetch that hangs fires neither onload nor onerror — without a
 * deadline every caller awaiting a token would stall with it. The challenge
 * itself gets no deadline: an interactive solve legitimately waits on the
 * user, and the widget's own timeout-callback covers a stuck one. */
export const SCRIPT_TIMEOUT_MS = 15_000;

function loadScript(): Promise<void> {
	if (window.turnstile) return Promise.resolve();
	if (scriptPromise) return scriptPromise;

	scriptPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		const fail = (message: string) => {
			scriptPromise = null;
			script.remove();
			reject(new Error(message));
		};
		const deadline = setTimeout(() => fail('Turnstile script timed out'), SCRIPT_TIMEOUT_MS);
		script.src = SCRIPT_URL;
		script.async = true;
		script.defer = true;
		script.onload = () => {
			clearTimeout(deadline);
			resolve();
		};
		script.onerror = () => {
			clearTimeout(deadline);
			fail('Turnstile script failed to load');
		};
		document.head.appendChild(script);
	});
	return scriptPromise;
}

/**
 * Obtain a fresh Turnstile token for `siteKey`, or `null` when no site key is
 * configured (dev, where the server gate fails open). Renders an unobtrusive
 * widget bottom-right; managed mode usually solves it without interaction.
 */
export async function getTurnstileToken(siteKey: string | undefined): Promise<string | null> {
	if (!siteKey) return null;
	await loadScript();
	const turnstile = window.turnstile;
	if (!turnstile) return null;

	return new Promise<string>((resolve, reject) => {
		const container = document.createElement('div');
		container.style.position = 'fixed';
		container.style.bottom = '12px';
		container.style.right = '12px';
		container.style.zIndex = '9999';
		document.body.appendChild(container);

		let widgetId = '';
		const cleanup = () => {
			try {
				if (widgetId) turnstile.remove(widgetId);
			} catch {
				// widget already gone
			}
			container.remove();
		};

		widgetId = turnstile.render(container, {
			sitekey: siteKey,
			callback: (token: string) => {
				cleanup();
				resolve(token);
			},
			'error-callback': () => {
				cleanup();
				reject(new Error('Turnstile challenge failed'));
			},
			'timeout-callback': () => {
				cleanup();
				reject(new Error('Turnstile challenge timed out'));
			}
		});
	});
}
