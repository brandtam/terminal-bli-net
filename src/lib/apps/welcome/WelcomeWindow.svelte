<script lang="ts">
	let { onopen }: { onopen: (id: string) => void } = $props();
</script>

<div class="welcome">
	<h1>terminal<span class="accent">.bli.net</span><span class="blink-cursor"></span></h1>
	<div class="lede">
		<b>Previously on screens…</b><br />
		A retro desktop you visit in a browser. Drag windows. Open apps. Tweak things until they feel right.
	</div>
	<p class="tagline">
		Terminal is a tiny operating system that runs in a tab. Floppy icons, striped title bars, chunky
		borders, a clock you can change. It's what computers looked like before screens got slick.
	</p>
	<p class="tagline">
		Start at the <b>Computer Store</b> — browse the aisles, pick up software boxes, and bring them
		to the counter. Purchased apps land on <b>My Shelf</b>, where you install and uninstall them.
	</p>
	<p class="tagline">
		Once you've got apps installed, the desktop is yours. Drag windows around, stack them, lose one
		behind another and fish it out of the dock.
	</p>
	<div class="btn-row">
		<button class="btn primary" onclick={() => onopen('computer-store')}>VISIT THE STORE</button>
	</div>
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
	<p class="muted" style="margin:0;">
		&uarr; open windows by double-clicking the icons, dragging stuff around, or pretending it's
		1994.
	</p>
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
	.tagline {
		font-size: 22px;
		line-height: 1.3;
		margin: 0 0 18px;
	}
	.btn-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 14px;
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
