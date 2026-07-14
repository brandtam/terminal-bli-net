<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';
	import { BAUD_RATES, type BaudRate } from './terminal';
	import {
		PHOSPHOR_COLORS,
		loadPrefs,
		prefs,
		setBaud,
		setPhosphor,
		type PhosphorTint
	} from './prefs.svelte';
	import { freshProgress, loadProgress, saveProgress } from './persistence';

	// Zero-prop window: reads the shared dialer prefs store and the OS master
	// audio, writes both back through their owners.
	const { os, fs, storage } = getAppContext();
	loadPrefs(storage);

	const tints: PhosphorTint[] = ['amber', 'green', 'white'];
	let resetState = $state<'idle' | 'confirm' | 'done'>('idle');

	async function resetProgress(): Promise<void> {
		if (resetState !== 'confirm') {
			resetState = 'confirm';
			return;
		}
		// Keep the caller logged in; wipe only the single-player progress.
		const current = await loadProgress(fs);
		await saveProgress(fs, {
			...freshProgress(),
			handle: current.handle,
			session: current.session
		});
		resetState = 'done';
	}
</script>

<div class="prefs" style="--phos: {PHOSPHOR_COLORS[prefs.phosphor]}">
	<h3 class="heading">DIALER PREFERENCES</h3>

	<div class="row">
		<div class="label">DEFAULT BAUD</div>
		<div class="segment">
			{#each BAUD_RATES as rate (rate)}
				<button
					class="seg-btn"
					class:active={prefs.baud === rate}
					onclick={() => setBaud(storage, rate as BaudRate)}
				>
					{rate}
				</button>
			{/each}
		</div>
		<div class="hint">how fast the terminal types — 300 is authentically slow</div>
	</div>

	<div class="row">
		<div class="label">PHOSPHOR</div>
		<div class="segment">
			{#each tints as tint (tint)}
				<button
					class="seg-btn"
					class:active={prefs.phosphor === tint}
					style="color: {prefs.phosphor === tint ? '#000' : PHOSPHOR_COLORS[tint]}"
					onclick={() => setPhosphor(storage, tint)}
				>
					{tint.toUpperCase()}
				</button>
			{/each}
		</div>
		<div class="hint">the glow of the tube</div>
	</div>

	<div class="row">
		<div class="label">SOUND</div>
		<label class="check">
			<input
				type="checkbox"
				checked={os.audio.muted}
				onchange={(e) => os.audio.setMuted((e.target as HTMLInputElement).checked)}
			/>
			<span>{os.audio.muted ? 'muted' : 'on'}</span>
		</label>
		<input
			class="slider"
			type="range"
			min={0}
			max={1}
			step={0.05}
			disabled={os.audio.muted}
			value={os.audio.volume}
			oninput={(e) => os.audio.setVolume(parseFloat((e.target as HTMLInputElement).value))}
		/>
		<div class="hint">volume and mute are the OS master — every app hears it</div>
	</div>

	<div class="row">
		<div class="label">PROGRESS</div>
		<button class="danger" onclick={() => void resetProgress()}>
			{#if resetState === 'confirm'}
				REALLY WIPE THE PHONEBOOK?
			{:else if resetState === 'done'}
				DONE — REDIAL TO REBUILD IT
			{:else}
				RESET PROGRESS…
			{/if}
		</button>
		<div class="hint">forgets found numbers, scanlogs, and your door score — keeps your handle</div>
	</div>
</div>

<style>
	.prefs {
		padding: 14px;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 17px;
		background: #000;
		color: var(--phos, #ffb000);
		height: 100%;
		box-sizing: border-box;
		--phos: #ffb000;
	}

	.heading {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 11px;
		margin: 0 0 16px;
		font-weight: normal;
		letter-spacing: 1px;
	}

	.row {
		margin-bottom: 14px;
		border-bottom: 1px solid rgba(255, 176, 0, 0.25);
		padding-bottom: 12px;
	}

	.label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 8px;
		letter-spacing: 1px;
		margin-bottom: 8px;
		opacity: 0.8;
	}

	.segment {
		display: flex;
		gap: 6px;
	}

	.seg-btn {
		flex: 1;
		background: #000;
		border: 2px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		padding: 5px 0;
		cursor: pointer;
	}

	.seg-btn.active {
		background: var(--phos);
		color: #000;
	}

	.check {
		display: flex;
		gap: 8px;
		align-items: center;
		cursor: pointer;
		margin-bottom: 8px;
	}

	.slider {
		width: 100%;
		accent-color: var(--phos);
	}

	.hint {
		opacity: 0.55;
		font-size: 13px;
		margin-top: 4px;
	}

	.danger {
		width: 100%;
		background: #000;
		border: 2px solid #f55;
		color: #f55;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		padding: 6px 0;
		cursor: pointer;
	}

	.danger:hover {
		background: #f55;
		color: #000;
	}
</style>
