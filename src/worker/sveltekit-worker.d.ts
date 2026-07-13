/// <reference types="@cloudflare/workers-types" />
/**
 * Ambient type for the `sveltekit-worker` bare specifier, which wrangler's
 * `alias` config resolves to the adapter-generated worker at
 * .svelte-kit/cloudflare/_worker.js. Typing it here (instead of importing the
 * generated file relatively) keeps `checkJs` from typechecking the entire
 * generated server bundle.
 */
declare module 'sveltekit-worker' {
	const worker: {
		fetch(
			request: Request,
			env: App.Platform['env'],
			ctx: ExecutionContext
		): Response | Promise<Response>;
	};
	export default worker;
}
