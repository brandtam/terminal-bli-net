<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';

	// Window components take ZERO props. Everything comes from the shared context:
	//   os     — the live OS API (launch apps, show alerts, read reactive state)
	//   fs     — the live filesystem
	//   window — this window's id, parsed args, and close/focus actions
	const { os, window: appWindow } = getAppContext();

	// Local component state works exactly like any Svelte 5 component.
	let clicks = $state(0);

	function sayHello() {
		// A real call into the OS — pops a system alert dialog.
		os.alert({
			title: 'Hello from your app',
			body: `You clicked the button ${clicks} time${clicks === 1 ? '' : 's'}.`
		});
	}
</script>

<div class="hello">
	<h1>Hello, world.</h1>
	<p>
		This window is a complete Terminal app. It reads the OS through <code>getAppContext()</code> and renders
		— no props, no OS edits.
	</p>

	<button onclick={() => clicks++}>Clicked {clicks} time{clicks === 1 ? '' : 's'}</button>
	<button onclick={sayHello}>Say hello in an alert</button>
	<button onclick={() => os.openAbout('hello-world')}>Open my About box</button>

	<p class="hint">
		This window's id is <code>{appWindow.id}</code>. Close it from the File menu or ⌘W.
	</p>
</div>

<style>
	.hello {
		padding: 18px;
		display: grid;
		gap: 12px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		color: var(--ink);
	}
	h1 {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 14px;
		margin: 0;
	}
	p {
		font-size: 16px;
		line-height: 1.4;
		margin: 0;
	}
	code {
		background: var(--paper-soft, rgba(0, 0, 0, 0.08));
		padding: 1px 4px;
		border-radius: 2px;
	}
	button {
		font-family: inherit;
		font-size: 15px;
		padding: 6px 10px;
		cursor: pointer;
	}
	.hint {
		font-size: 14px;
		opacity: 0.8;
	}
</style>
