<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';
	import { runWelcomeTourAction } from './welcome-tour';

	const ctx = getAppContext();
	const openWindowCount = $derived(ctx.os.windows.length);
	const installedAppCount = $derived(ctx.fs.getInstalledApps().length);

	function openComputerStore() {
		runWelcomeTourAction(ctx, 'computer-store');
	}

	function openShelf() {
		runWelcomeTourAction(ctx, 'software-shop');
	}
</script>

<div class="welcome">
	<h1>terminal<span class="accent">.bli.net</span><span class="blink-cursor"></span></h1>
	<div class="lede">
		<b>Previously on screens…</b><br />
		A retro desktop you visit in a browser. Nothing's installed yet — so let's get a movie playing first.
	</div>

	<p class="tagline">
		Follow along. It takes about a minute, and there's a working VCR at the end of it.
	</p>

	<div class="tour-panel">
		<div>
			<div class="panel-label">LIVE TOUR</div>
			<div class="panel-copy">
				{openWindowCount} windows open · {installedAppCount} apps available ·
				{ctx.storage.status} storage seam
			</div>
		</div>
		<div class="tour-actions">
			<button onclick={openComputerStore}>Computer Store</button>
			<button onclick={openShelf}>My Shelf</button>
		</div>
	</div>

	<ol class="steps">
		<li>Click the <b>icon</b> in the <b>top-left corner</b> of the menu bar.</li>
		<li>Choose <b>Computer Store</b> from that menu.</li>
		<li>
			Find the <b>VCR</b> on the shelves and buy it at the <b>checkout</b>, then leave the store.
		</li>
		<li>Open that menu again and pick <b>My Shelf</b>.</li>
		<li>Hit <b>Install</b> next to the VCR. A VCR drops onto your desktop.</li>
		<li>Double-click the <b>VCR</b>, choose a tape, and press <b>&#9654;</b>. Be kind, rewind.</li>
	</ol>

	<p class="tagline">
		After that the desktop is yours. Drag windows around, stack them, lose one behind another and
		fish it out of the dock.
	</p>

	<p class="tagline">
		Then head back to the <b>Computer Store</b> — there's a whole shelf of apps to play with, and plenty
		of hidden features tucked away. Poke around and see how many retro Easter eggs you can dig up.
	</p>

	<div class="logo-marquee">
		<div class="logo-marquee-track">
			<span>&#9733; TERMINAL — terminal.bli.net</span>
			<span>&#9733; NO COOKIES, NO TRACKING, NO ANALYTICS</span>
			<span>&#9733; ONE TAB, ONE DESKTOP</span>
			<span>&#9733; ONE PERSON'S PROJECT, NOT A PLATFORM</span>
			<span>&#9733; TERMINAL — terminal.bli.net</span>
			<span>&#9733; NO COOKIES, NO TRACKING, NO ANALYTICS</span>
			<span>&#9733; ONE TAB, ONE DESKTOP</span>
			<span>&#9733; ONE PERSON'S PROJECT, NOT A PLATFORM</span>
		</div>
	</div>
	<p class="muted" style="margin:0;">&uarr; everything opens by clicking around.</p>
</div>

<style>
	.welcome {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.35;
	}
	h1 {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 28px;
		line-height: 1.2;
		margin: 0 0 14px;
		letter-spacing: -1px;
		font-weight: normal;
	}
	.accent {
		color: var(--accent);
	}
	.blink-cursor {
		display: inline-block;
		width: 14px;
		height: 24px;
		background: var(--ink);
		vertical-align: -4px;
		margin-left: 4px;
		animation: blink 1s steps(2, end) infinite;
	}
	.lede {
		font-size: 20px;
		line-height: 1.35;
		margin: 0 0 16px;
		background: var(--accent-2);
		padding: 10px 12px;
		border: 2px solid var(--ink);
	}
	.tour-panel {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
		margin: 0 0 18px;
		padding: 10px;
		border: 2px solid var(--ink);
		background: var(--paper-soft);
		box-shadow: 3px 3px 0 var(--shadow);
	}
	.panel-label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		margin-bottom: 6px;
		color: var(--accent);
	}
	.panel-copy {
		font-size: 18px;
		line-height: 1.2;
	}
	.tour-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.tour-actions button {
		border: 2px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		box-shadow: 2px 2px 0 var(--ink);
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 16px;
		padding: 7px 8px;
		cursor: pointer;
	}
	.tour-actions button:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	.tagline {
		font-size: 22px;
		line-height: 1.3;
		margin: 0 0 18px;
	}
	.steps {
		list-style: none;
		counter-reset: step;
		margin: 0 0 18px;
		padding: 0;
		border: 2px solid var(--ink);
		background: var(--paper-soft);
	}
	.steps li {
		position: relative;
		padding: 9px 12px 9px 44px;
		font-size: 20px;
		line-height: 1.3;
		border-bottom: 2px solid var(--ink);
	}
	.steps li:last-child {
		border-bottom: none;
	}
	.steps li::before {
		counter-increment: step;
		content: counter(step);
		position: absolute;
		left: 9px;
		top: 9px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: var(--paper);
		border: 2px solid var(--ink);
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
	}
	.logo-marquee {
		overflow: hidden;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
		background: var(--paper-soft);
		padding: 10px 0;
		margin: 14px 0;
	}
	.logo-marquee-track {
		display: flex;
		gap: 36px;
		animation: scroll-marquee 22s linear infinite;
		white-space: nowrap;
		width: max-content;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
	}
</style>
