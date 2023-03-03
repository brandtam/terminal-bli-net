<script>
	import "../app.css";

	import * as Sentry from "@sentry/svelte";
	import { BrowserTracing } from "@sentry/tracing";

	Sentry.init({
		dsn: "https://REDACTED_SENTRY_DSN",
		integrations: [new BrowserTracing()],
		// We recommend adjusting this value in production, or using tracesSampler
		// for finer control
		tracesSampleRate: 1.0,
	});
</script>

<svelte:head>
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
	<link rel="manifest" href="/site.webmanifest">
	<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5">
	<meta name="msapplication-TileColor" content="#603cba">
	<meta name="theme-color" content="#eeeeee">
</svelte:head>

<html data-theme="emerald" class="h-full" lang="en">
	<body class="h-full">
		<slot />
	</body>
</html>