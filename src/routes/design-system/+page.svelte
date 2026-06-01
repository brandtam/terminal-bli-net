<script lang="ts">
	import Dropdown from '$lib/components/Dropdown.svelte';
	import PixelIcon from '$lib/components/PixelIcon.svelte';

	let dropdownValue = $state('seinfeld');
	const dropdownOptions = [
		{ value: 'seinfeld', label: 'Seinfeld' },
		{ value: 'office', label: 'The Office' },
		{ value: 'friends', label: 'Friends' },
		{ value: 'mash', label: 'M*A*S*H' },
		{ value: 'always', label: "It's Always Sunny" }
	];

	const colors = [
		{ name: '--ink', cssVar: 'var(--ink)', desc: 'Primary foreground' },
		{ name: '--paper', cssVar: 'var(--paper)', desc: 'Primary background' },
		{ name: '--paper-soft', cssVar: 'var(--paper-soft)', desc: 'Soft background' },
		{ name: '--accent', cssVar: 'var(--accent)', desc: 'Orange accent' },
		{ name: '--accent-2', cssVar: 'var(--accent-2)', desc: 'Yellow accent' },
		{ name: '--bg', cssVar: 'var(--bg)', desc: 'Desktop teal' },
		{ name: '--shadow', cssVar: 'var(--shadow)', desc: 'Shadow color' }
	];

	const iconKinds = ['hd', 'folder', 'tv', 'doc', 'trash', 'calc', 'floppy', 'guide'];

	const tokenLayers = [
		{
			name: 'Brand tokens',
			prefix: '--brand-*',
			file: 'brand.css',
			desc: 'The constants: palette, fonts, the size scale, the 4px spacing scale, radius, and motion easings. Defined once at :root and never overridden by a theme.'
		},
		{
			name: 'Chrome tokens',
			prefix: '--chrome-*',
			file: 'chrome.system7.css',
			desc: 'The per-theme surface — window, title bar, menu, dock, dialog, scrollbar, cursor. A theme sets these; they reference brand tokens as their values/fallbacks. Win95 is a separate chrome file.'
		},
		{
			name: 'Wallpaper tokens',
			prefix: '--wallpaper-*',
			file: 'brand.css',
			desc: 'The desktop background palettes — a base fill plus a dither/speckle overlay per pattern (teal, speckle, yellow, pink, navy). Consumed by Desktop.svelte.'
		},
		{
			name: 'Bridge aliases',
			prefix: '--ink, --paper, --accent…',
			file: 'app.css',
			desc: 'Short ergonomic names mapping straight to brand tokens (--ink → --brand-color-ink, --accent → --brand-color-orange). Most app chrome reaches for these.'
		}
	];
</script>

<svelte:head>
	<title>Design System — Terminal</title>
</svelte:head>

<div class="ds-page" data-os-theme="system7">
	<header class="ds-header">
		<h1>Design System</h1>
		<p>Living style guide for Terminal — previously on screens...</p>
	</header>

	<!-- Token Layers -->
	<section class="ds-section">
		<h2>Token Layers</h2>
		<p class="ds-desc">
			Design tokens stack in layers. A contributor styling app chrome reaches for the bridge
			aliases; a theme author sets chrome tokens; both bottom out in the brand constants. Reach for
			the layer that matches what you're changing.
		</p>
		<div class="layer-grid">
			{#each tokenLayers as layer (layer.name)}
				<div class="layer-card">
					<div class="layer-head">
						<strong class="layer-name">{layer.name}</strong>
						<code class="layer-prefix">{layer.prefix}</code>
					</div>
					<span class="layer-file">{layer.file}</span>
					<p class="layer-desc">{layer.desc}</p>
				</div>
			{/each}
		</div>
		<p class="ds-desc layer-notes">
			<strong>Typography</strong> — reach for <code>--brand-font-*</code> (display / body / ui) and
			the <code>--brand-text-*</code> size scale. <strong>Spacing</strong> — the
			<code>--brand-space-*</code> 4px scale (space-1 = 4px … space-12 = 48px).
			<strong>Motion</strong> — <code>--brand-easing-snap</code> (linear) and
			<code>--brand-easing-pop</code> (overshoot). <strong>Icons</strong> are intentional pixel art: PixelIcon
			fills are pinned inline and deliberately not tokenized, so an icon reads on any theme.
		</p>
		<h3 class="recipe-title">Adding a themed color</h3>
		<ol class="recipe">
			<li>
				Add the constant to the palette block in <code>brand.css</code>:
				<code>--brand-color-foo: #abc123;</code>. This is the single source of truth.
			</li>
			<li>
				If app code wants a short name, add a bridge alias in <code>app.css</code>:
				<code>--foo: var(--brand-color-foo);</code>.
			</li>
			<li>
				If a theme's chrome should use it, point a chrome token at it in the theme file:
				<code>--chrome-…: var(--brand-color-foo);</code> — never the raw hex.
			</li>
			<li>
				For a new wallpaper, add <code>--wallpaper-foo-base</code> / <code>-dither</code> in
				<code>brand.css</code> and reference them in <code>Desktop.svelte</code>.
			</li>
			<li>
				A TS default that can't read a CSS var (e.g. a persisted default) carries the hex with a
				comment naming the token it mirrors — see <code>persistence.ts</code>'s accent default.
			</li>
		</ol>
	</section>

	<!-- Color Palette -->
	<section class="ds-section">
		<h2>Color Palette</h2>
		<div class="swatch-grid">
			{#each colors as c (c.name)}
				<div class="swatch-card">
					<div class="swatch-block" style="background: {c.cssVar};"></div>
					<code class="swatch-name">{c.name}</code>
					<span class="swatch-desc">{c.desc}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- Typography -->
	<section class="ds-section">
		<h2>Typography</h2>

		<div class="type-row">
			<div class="type-meta">
				<code>--brand-font-display</code>
				<span>Press Start 2P</span>
			</div>
			<div class="type-samples font-display">
				<span style="font-size: 8px;">8px — Section labels, badges</span>
				<span style="font-size: 10px;">10px — Headings, UI labels</span>
				<span style="font-size: 14px;">14px — Title bar text</span>
			</div>
		</div>

		<div class="type-row">
			<div class="type-meta">
				<code>--brand-font-ui</code>
				<span>Pixelify Sans</span>
			</div>
			<div class="type-samples font-ui">
				<span style="font-size: 14px;">14px — Small UI</span>
				<span style="font-size: 16px;">16px — Buttons, menus</span>
				<span style="font-size: 20px;">20px — Larger UI text</span>
			</div>
		</div>

		<div class="type-row">
			<div class="type-meta">
				<code>--brand-font-body</code>
				<span>VT323</span>
			</div>
			<div class="type-samples font-body">
				<span style="font-size: 16px;">16px — Small body</span>
				<span style="font-size: 19px;">19px — Chat messages</span>
				<span style="font-size: 24px;">24px — Large body text</span>
			</div>
		</div>
	</section>

	<!-- Buttons -->
	<section class="ds-section">
		<h2>Buttons</h2>
		<div class="btn-grid">
			<div class="btn-demo">
				<button class="btn">Default</button>
				<code>.btn</code>
			</div>
			<div class="btn-demo">
				<button class="btn primary">Primary</button>
				<code>.btn.primary</code>
			</div>
			<div class="btn-demo">
				<button class="btn yellow">Yellow</button>
				<code>.btn.yellow</code>
			</div>
			<div class="btn-demo">
				<button class="btn selected">Selected</button>
				<code>.btn.selected</code>
			</div>
			<div class="btn-demo">
				<button class="btn" disabled>Disabled</button>
				<code>.btn:disabled</code>
			</div>
			<div class="btn-demo">
				<button class="btn btn-with-chip">
					<span class="btn-chip" style="background: var(--accent);"></span>
					With Chip
				</button>
				<code>.btn-with-chip</code>
			</div>
		</div>
	</section>

	<!-- Dropdown -->
	<section class="ds-section">
		<h2>Dropdown</h2>
		<p class="ds-desc">
			Reusable dropdown with checkmark selection. Supports separator lines between groups.
		</p>
		<div class="dropdown-demo">
			<Dropdown options={dropdownOptions} bind:value={dropdownValue} separatorAfter={['office']} />
			<span class="dropdown-status">Selected: <code>{dropdownValue}</code></span>
		</div>
	</section>

	<!-- Form Elements -->
	<section class="ds-section">
		<h2>Form Elements</h2>
		<div class="form-grid">
			<div class="form-demo">
				<label for="ds-input-normal">Normal input</label>
				<div class="chat-input-demo">
					<input id="ds-input-normal" placeholder="say something to the room..." />
					<button class="send-btn">SEND</button>
				</div>
			</div>
			<div class="form-demo">
				<label for="ds-input-disabled">Disabled input</label>
				<div class="chat-input-demo">
					<input id="ds-input-disabled" placeholder="show is off air" disabled />
					<button class="send-btn" disabled>OFF AIR</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Bubbles / Messages -->
	<section class="ds-section">
		<h2>Chat Bubbles</h2>
		<div class="bubble-demo">
			<div class="bubble system">
				— Switched to Seinfeld. Jerry, George, Elaine are now in the room. —
			</div>
			<div class="bubble user">
				<span class="who-label">YOU</span>
				What's the deal with airline peanuts?
			</div>
			<div class="bubble bot">
				<span class="who-label">JERRY SEINFELD</span>
				<p>
					See, that's what I'm saying! They give you these tiny bags — you can't even get your
					fingers in there.
				</p>
			</div>
			<div class="bubble bot typing">
				<span class="who-label">GEORGE COSTANZA is typing</span>
				<span class="dot">●</span><span class="dot">●</span><span class="dot">●</span>
			</div>
		</div>
	</section>

	<!-- Window Chrome -->
	<section class="ds-section">
		<h2>Window Chrome</h2>
		<p class="ds-desc">System 7-style window with title bar, close button, border, and shadow.</p>
		<div class="window-demo">
			<div class="demo-window">
				<div class="demo-titlebar">
					<span class="demo-close-btn">&times;</span>
					<span class="demo-title">Sample Window</span>
				</div>
				<div class="demo-window-body">
					<p>Window content area. Draggable from the title bar, resizable from the corner.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Keyboard Shortcuts -->
	<section class="ds-section">
		<h2>Keyboard Shortcuts</h2>
		<div class="kbd-grid">
			<span class="kbd">&#x2318;N</span>
			<span class="kbd">&#x2318;W</span>
			<span class="kbd">Esc</span>
			<span class="kbd">&#x2318;Shift+K</span>
			<span class="kbd">Tab</span>
			<span class="kbd">Enter</span>
		</div>
	</section>

	<!-- Icons -->
	<section class="ds-section">
		<h2>Icons</h2>
		<p class="ds-desc">PixelIcon component — 16x16 SVG pixel art icons rendered at 52x52.</p>
		<div class="icon-grid">
			{#each iconKinds as kind (kind)}
				<div class="icon-demo">
					<PixelIcon {kind} />
					<code>{kind}</code>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.ds-page {
		min-height: 100vh;
		background: var(--bg);
		padding: 40px 20px 80px;
		overflow-y: auto;
	}

	.ds-header {
		max-width: 800px;
		margin: 0 auto 40px;
		text-align: center;
	}
	.ds-header h1 {
		font-family: var(--brand-font-display);
		font-size: 18px;
		color: var(--paper);
		margin: 0 0 12px;
		text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.4);
	}
	.ds-header p {
		font-family: var(--brand-font-body);
		font-size: 22px;
		color: var(--paper);
		margin: 0;
		opacity: 0.9;
	}

	.ds-section {
		max-width: 800px;
		margin: 0 auto 32px;
		background: var(--paper);
		border: 2px solid var(--ink);
		box-shadow: 3px 3px 0 var(--ink);
		padding: 24px;
	}
	.ds-section h2 {
		font-family: var(--brand-font-display);
		font-size: 10px;
		margin: 0 0 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--ink);
		letter-spacing: 0.05em;
	}
	.ds-desc {
		font-family: var(--brand-font-body);
		font-size: 19px;
		margin: 0 0 16px;
		opacity: 0.8;
	}

	/* Token Layers */
	.layer-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}
	.layer-card {
		border: 2px solid var(--ink);
		background: var(--paper-soft);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.layer-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.layer-name {
		font-family: var(--brand-font-ui);
		font-size: 16px;
	}
	.layer-prefix {
		font-family: var(--brand-font-body);
		font-size: 16px;
		background: var(--paper);
		padding: 1px 5px;
		border: 1px solid var(--ink);
	}
	.layer-file {
		font-family: var(--brand-font-display);
		font-size: 8px;
		opacity: 0.7;
	}
	.layer-desc {
		font-family: var(--brand-font-body);
		font-size: 17px;
		line-height: 1.3;
		margin: 4px 0 0;
	}
	.layer-notes {
		margin-top: 16px;
		margin-bottom: 0;
	}
	.layer-notes code {
		background: var(--paper-soft);
		padding: 1px 4px;
		border: 1px solid var(--ink);
	}
	.recipe-title {
		font-family: var(--brand-font-ui);
		font-size: 18px;
		margin: 20px 0 8px;
	}
	.recipe {
		font-family: var(--brand-font-body);
		font-size: 17px;
		line-height: 1.35;
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.recipe code {
		background: var(--paper-soft);
		padding: 1px 4px;
		border: 1px solid var(--ink);
	}

	/* Color Palette */
	.swatch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}
	.swatch-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.swatch-block {
		width: 100%;
		height: 48px;
		border: 2px solid var(--ink);
	}
	.swatch-name {
		font-family: var(--brand-font-body);
		font-size: 17px;
	}
	.swatch-desc {
		font-family: var(--brand-font-ui);
		font-size: 12px;
		opacity: 0.7;
	}

	/* Typography */
	.type-row {
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px dashed var(--ink);
	}
	.type-row:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}
	.type-meta {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 8px;
	}
	.type-meta code {
		font-family: var(--brand-font-body);
		font-size: 16px;
		background: var(--paper-soft);
		padding: 2px 6px;
		border: 1px solid var(--ink);
	}
	.type-meta span {
		font-family: var(--brand-font-ui);
		font-size: 14px;
		opacity: 0.7;
	}
	.type-samples {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.font-display {
		font-family: var(--brand-font-display);
	}
	.font-ui {
		font-family: var(--brand-font-ui);
	}
	.font-body {
		font-family: var(--brand-font-body);
	}

	/* Buttons */
	.btn-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-end;
	}
	.btn-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.btn-demo code {
		font-family: var(--brand-font-body);
		font-size: 15px;
		opacity: 0.7;
	}

	/* Dropdown */
	.dropdown-demo {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.dropdown-status {
		font-family: var(--brand-font-body);
		font-size: 19px;
	}
	.dropdown-status code {
		background: var(--paper-soft);
		padding: 2px 6px;
		border: 1px solid var(--ink);
	}

	/* Form Elements */
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.form-demo label {
		display: block;
		font-family: var(--brand-font-display);
		font-size: 8px;
		margin-bottom: 6px;
		opacity: 0.7;
	}
	.chat-input-demo {
		display: flex;
		border: 2px solid var(--ink);
		background: var(--paper-soft);
	}
	.chat-input-demo input {
		flex: 1;
		border: none;
		background: var(--paper);
		padding: 10px 12px;
		font-family: var(--brand-font-body);
		font-size: 19px;
		outline: none;
	}
	.chat-input-demo input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.send-btn {
		border: none;
		border-left: 2px solid var(--ink);
		background: var(--accent);
		color: var(--paper);
		padding: 0 16px;
		font-family: var(--brand-font-display);
		font-size: 10px;
		cursor: pointer;
		letter-spacing: 1px;
	}
	.send-btn:hover {
		background: var(--ink);
	}
	.send-btn:disabled {
		background: var(--paper-soft);
		color: var(--ink);
		cursor: not-allowed;
	}

	/* Bubbles */
	.bubble-demo {
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--paper);
		padding: 12px;
		border: 1px solid var(--ink);
		font-family: var(--brand-font-body);
		font-size: 19px;
		line-height: 1.3;
	}
	.bubble {
		max-width: 85%;
		padding: 8px 10px;
		border: 2px solid var(--ink);
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.bubble :global(p) {
		margin: 0;
	}
	.who-label {
		display: block;
		font-family: var(--brand-font-display);
		font-size: 8px;
		margin-bottom: 4px;
		opacity: 0.7;
	}
	.bubble.user {
		align-self: flex-end;
		background: var(--accent-2);
	}
	.bubble.bot {
		align-self: flex-start;
		background: var(--paper);
		border-left: 4px solid var(--accent);
	}
	.bubble.system {
		align-self: center;
		background: var(--paper-soft);
		font-style: italic;
		max-width: 95%;
		text-align: center;
		font-size: 16px;
	}
	.bubble.typing {
		font-family: var(--brand-font-display);
		font-size: 10px;
	}
	.dot {
		display: inline-block;
		animation: blink 1s steps(2, end) infinite;
	}
	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	/* Window Chrome */
	.window-demo {
		display: flex;
		justify-content: center;
	}
	.demo-window {
		width: 320px;
		border: 2px solid var(--ink);
		box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
		background: var(--paper);
	}
	.demo-titlebar {
		height: 22px;
		display: flex;
		align-items: center;
		padding: 0 6px;
		border-bottom: 2px solid var(--ink);
		background: repeating-linear-gradient(0deg, var(--ink) 0 1px, var(--paper) 1px 3px);
	}
	.demo-close-btn {
		width: 14px;
		height: 14px;
		background: var(--paper);
		border: 1px solid var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		flex-shrink: 0;
	}
	.demo-title {
		flex: 1;
		text-align: center;
		font: 600 14px var(--brand-font-ui);
		color: var(--ink);
		background: var(--paper);
		padding: 0 4px;
		margin: 0 8px;
	}
	.demo-window-body {
		padding: 16px;
		font-family: var(--brand-font-body);
		font-size: 19px;
	}
	.demo-window-body p {
		margin: 0;
	}

	/* Keyboard Shortcuts */
	.kbd-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	/* Icons */
	.icon-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}
	.icon-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.icon-demo code {
		font-family: var(--brand-font-body);
		font-size: 15px;
		opacity: 0.7;
	}
</style>
