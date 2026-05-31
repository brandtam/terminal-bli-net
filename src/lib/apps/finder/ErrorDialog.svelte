<script lang="ts">
	import { getSystem } from '$lib/os/os-context';

	// Zero-prop window component: both buttons just dismiss this window, and the
	// handle from getSystem() already closes by this window's own id.
	const { win } = getSystem();
</script>

<div class="error">
	<div class="bomb">⚠</div>
	<div class="body">
		<div class="title">Sorry, a system error occurred.</div>
		<div class="detail">
			"ID = -42: hubris overflow"<br />
			<span class="muted">You knew this would happen.</span>
		</div>
		<div class="btns">
			<button class="btn" onclick={() => win.close()}>Restart</button>
			<button class="btn primary" onclick={() => win.close()}>Forget it</button>
		</div>
	</div>
</div>

<style>
	.error {
		padding: 18px;
		display: flex;
		gap: 14px;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 14px;
		height: 100%;
		box-sizing: border-box;
	}
	.bomb {
		width: 44px;
		height: 44px;
		background: var(--ink);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--paper);
		font-size: 28px;
		flex-shrink: 0;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.title {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		margin-bottom: 10px;
		line-height: 1.4;
	}
	.detail {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 17px;
		margin-bottom: 14px;
		line-height: 1.3;
	}
	.btns {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
</style>
