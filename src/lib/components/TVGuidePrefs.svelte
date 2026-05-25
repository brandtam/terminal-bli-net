<script lang="ts">
	import type { TweaksState } from '$lib/types';

	let {
		tweaks,
		onSetTweak
	}: {
		tweaks: TweaksState;
		onSetTweak: (key: keyof TweaksState, value: TweaksState[keyof TweaksState]) => void;
	} = $props();
</script>

<div class="window-content prefs-content">
	<h3 class="prefs-heading">TV GUIDE PREFERENCES</h3>
	<div class="pref-row">
		<div class="pref-label">GRID LOOP</div>
		<input
			type="range"
			min={30}
			max={400}
			step={5}
			value={tweaks.tvGridLoop}
			oninput={(e) => onSetTweak('tvGridLoop', parseInt((e.target as HTMLInputElement).value, 10))}
			style="width: 100%;"
		/>
		<div class="pref-hint">
			{tweaks.tvGridLoop}s · how long for the timeline to scroll a full 24 hours
		</div>
	</div>
	<div class="pref-row">
		<div class="pref-label">MARQUEE LOOP</div>
		<input
			type="range"
			min={10}
			max={120}
			step={2}
			value={tweaks.marqueeLoop}
			oninput={(e) => onSetTweak('marqueeLoop', parseInt((e.target as HTMLInputElement).value, 10))}
			style="width: 100%;"
		/>
		<div class="pref-hint">{tweaks.marqueeLoop}s · bottom chyron drift speed</div>
	</div>
	<div class="pref-row">
		<div class="pref-label">PAUSE ON HOVER</div>
		<label style="display: flex; gap: 8px; align-items: center; cursor: pointer;">
			<input
				type="checkbox"
				checked={tweaks.tvPauseOnHover}
				onchange={(e) => onSetTweak('tvPauseOnHover', (e.target as HTMLInputElement).checked)}
			/>
			<span>{tweaks.tvPauseOnHover ? 'on' : 'off'}</span>
		</label>
		<div class="pref-hint">freeze the auto-scroll when your mouse is over the grid</div>
	</div>
	<p class="muted" style="margin-top: 16px; font-size: 15px;">
		Wallpaper, accent color, and other OS-wide settings live in the <span class="kbd">●</span> menu →
		Tweaks…
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
</style>
