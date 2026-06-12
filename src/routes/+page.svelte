<script lang="ts">
	import { env } from '$env/dynamic/public';
	import Desktop from '$lib/components/Desktop.svelte';

	// The one place the public Turnstile site key is read; it's threaded down
	// through the app context so leaf windows (the chat) stay env-free. Unset →
	// Turnstile not configured, and the server gate fails open.
	const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
</script>

<svelte:head>
	<title>Terminal — Previously on screens…</title>
</svelte:head>

<Desktop {turnstileSiteKey} />
