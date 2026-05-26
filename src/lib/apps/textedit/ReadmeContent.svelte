<div class="readme">
	<h3>README.TXT — Terminal v1.0</h3>
	<p>
		Terminal is a desktop OS that lives in a browser tab. Apps run inside it. You drag windows. You
		open the menu bar. You change the timezone by clicking the clock. The whole thing is meant to
		feel like a computer from 1995 that someone restored for you.
	</p>
	<h3>NAVIGATION</h3>
	<ul>
		<li><span class="kbd">Double-click</span> a desktop icon to open it</li>
		<li><span class="kbd">Drag</span> the title bar to move a window</li>
		<li><span class="kbd">Drag</span> the grow box (bottom-right or top-right) to resize</li>
		<li><span class="kbd">Click</span> a window to bring it forward</li>
		<li><span class="kbd">×</span> in the top-left closes it</li>
	</ul>
	<h3>KEYBOARD SHORTCUTS</h3>
	<ul>
		<li><span class="kbd">⌘N</span> open the default app for whatever's focused</li>
		<li><span class="kbd">⌘W</span> close the front window</li>
		<li><span class="kbd">⌘,</span> open Tweaks (preferences)</li>
	</ul>
	<h3>THE CLOCK</h3>
	<p>
		Top-right of the menu bar. Click it to change timezone. Every time-aware app reads from this
		clock, so changing it changes everything.
	</p>
	<h3>APPS</h3>
	<p>
		Each app on this desktop is its own thing. Click on an app's window, look at the menu bar. The
		menus change to match. Open the app's <b>Help</b> menu to find its preferences and its "About" page.
		That's where the app-specific manual lives — not here.
	</p>
	<h3>FAQ</h3>
	<p><b>What's the deal with the airing rule?</b> Open chatrbot's Help menu.</p>
	<p>
		<b>Where's my data?</b> localStorage. There is no server. Closing the tab loses nothing; clearing
		site data loses everything.
	</p>
	<p><b>Why does it look like this?</b> Because we like it.</p>
</div>

<style>
	.readme {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.35;
	}
	h3 {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 10px;
		margin: 14px 0 6px;
		font-weight: normal;
	}
	h3:first-child {
		margin-top: 0;
	}
	p {
		margin: 0 0 8px;
	}
	ul {
		padding-left: 18px;
		margin: 4px 0 8px;
	}
	li {
		margin: 2px 0;
	}
</style>
