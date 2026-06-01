<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="error-screen">
	<div class="error-box">
		<div class="error-icon">⚠</div>
		<div class="error-content">
			<h1>System Error {page.status}</h1>
			<p>{page.error?.message ?? 'Something went wrong.'}</p>
			<a href={resolve('/')} class="btn">← Back to desktop</a>
		</div>
	</div>
</div>

<style>
	.error-screen {
		height: 100vh;
		display: grid;
		place-items: center;
		background: var(--bg);
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
	}
	.error-box {
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 4px 4px 0 var(--shadow);
		padding: 24px;
		display: flex;
		gap: 16px;
		max-width: 420px;
	}
	.error-icon {
		width: 44px;
		height: 44px;
		background: var(--ink);
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--paper);
		font-size: 28px;
		flex-shrink: 0;
	}
	h1 {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		margin: 0 0 8px;
	}
	p {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		margin: 0 0 16px;
	}
</style>
