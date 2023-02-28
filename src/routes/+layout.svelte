<script>
	import "../app.css";

	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';

	inject({ mode: dev ? 'development' : 'production'});

</script>

<html data-theme="aqua" class="h-full" lang="en">
	<body class="h-full">
		<slot />
	</body>
</html>