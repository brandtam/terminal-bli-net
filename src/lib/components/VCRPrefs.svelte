<script lang="ts">
	import { vcrPrefs, type VcrDevice } from '$lib/apps/vcr/vcr-prefs.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';

	const DEVICE_OPTIONS: { value: VcrDevice; label: string }[] = [
		{ value: 'classic', label: 'Classic VCR' },
		{ value: 'ag500r', label: 'Panasonic AG-500R' }
	];

	let device = $state<VcrDevice>(vcrPrefs.device);
	$effect(() => {
		vcrPrefs.setDevice(device);
	});
</script>

<div class="window-content prefs-content">
	<h3 class="prefs-heading">VCR PREFERENCES</h3>
	<div class="pref-row">
		<div class="pref-label">DEVICE</div>
		<Dropdown options={DEVICE_OPTIONS} bind:value={device} />
		<div class="pref-hint">
			Classic is the standard deck. The AG-500R is a heavier monitor/player — same tapes, different
			machine.
		</div>
	</div>
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
