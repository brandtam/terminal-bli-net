<script lang="ts">
	import type { TweaksState } from '$lib/types';
	import { getAppContext } from '$lib/os/os-context';
	import { SYS7_PATTERNS } from './wallpaper-patterns';

	// Zero-prop window component: reads tweaks off the live OS context and writes
	// them back through os.setTweak. SYS7_PATTERNS is the static wallpaper list,
	// imported directly rather than threaded in as a prop.
	const { os } = getAppContext();
	const tweaks = $derived(os.tweaks);
	const onSetTweak = (key: keyof TweaksState, value: TweaksState[keyof TweaksState]) =>
		os.setTweak(key, value);
</script>

<div class="window-content prefs-content">
	<h3 class="prefs-heading">SYSTEM PREFERENCES</h3>
	<div class="pref-row">
		<div class="pref-label">WALLPAPER</div>
		<div class="pref-sublabel">Classic</div>
		<div style="display: flex; gap: 6px; flex-wrap: wrap;">
			{#each [{ value: 'teal', label: 'Teal', color: '#5e8585' }, { value: 'speckle', label: 'Speckle', color: '#c8bda6' }, { value: 'yellow', label: 'Yellow', color: '#f9bd2b' }, { value: 'pink', label: 'Pink', color: '#ee63b3' }, { value: 'navy', label: 'Navy', color: '#16243a' }] as opt (opt.value)}
				<button
					class="btn btn-with-chip {tweaks.wallpaper === opt.value ? 'selected' : ''}"
					onclick={() => onSetTweak('wallpaper', opt.value)}
				>
					<span class="btn-chip" style:background={opt.color}></span>
					{opt.label}
				</button>
			{/each}
		</div>
		<div class="pref-sublabel" style="margin-top: 10px;">System 7 Patterns</div>
		<div class="pattern-grid">
			{#each SYS7_PATTERNS as pat (pat)}
				<button
					class="pattern-thumb {tweaks.wallpaper === `sys7-${pat}` ? 'selected' : ''}"
					style="background-image: url(/themes/system7/wallpapers/{pat}.png);"
					onclick={() => onSetTweak('wallpaper', `sys7-${pat}`)}
					title="Pattern {pat}"
				></button>
			{/each}
		</div>
		<div class="pref-hint">desktop pattern — survives reload</div>
	</div>
	<div class="pref-row">
		<div class="pref-label">ACCENT</div>
		<div style="display: flex; gap: 6px;">
			{#each ['#f54e00', '#2b6cb0', '#a6f000', '#ff79c6', '#0a0a0a'] as c (c)}
				<button
					class="btn btn-swatch {tweaks.accent === c ? 'selected' : ''}"
					style:background={c}
					onclick={() => onSetTweak('accent', c)}
					title={c}
				></button>
			{/each}
		</div>
		<div class="pref-hint">primary call-to-action color across the OS</div>
	</div>
	<p class="muted" style="margin-top: 14px; font-size: 15px;">
		App-specific settings live in each app's Help → Preferences menu.
	</p>
</div>

<style>
	.window-content {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
		line-height: 1.35;
	}
	.prefs-content {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 18px;
	}
	.prefs-heading {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		margin: 0 0 14px;
		font-weight: normal;
	}
	.pref-row {
		margin-bottom: 14px;
		border-bottom: 1px solid var(--paper-soft);
		padding-bottom: 12px;
	}
	.pref-label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 9px;
		margin-bottom: 6px;
	}
	.pref-hint {
		opacity: 0.6;
		font-size: 14px;
		margin-top: 4px;
	}
	.pref-sublabel {
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 15px;
		opacity: 0.7;
		margin-bottom: 4px;
	}
	.pattern-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-height: 200px;
		overflow-y: auto;
		margin-top: 6px;
	}
	.pattern-thumb {
		width: 36px;
		height: 36px;
		border: 2px solid var(--ink);
		cursor: pointer;
		background-size: 64px 64px;
		image-rendering: pixelated;
	}
	.pattern-thumb:hover {
		box-shadow: 0 0 0 2px var(--accent);
	}
	.pattern-thumb.selected {
		box-shadow: 0 0 0 2px var(--accent);
		border-color: var(--accent);
	}
</style>
