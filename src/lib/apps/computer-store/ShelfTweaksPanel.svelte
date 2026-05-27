<script lang="ts">
	import { CATEGORIES } from './store-data';

	let {
		open,
		onopen,
		onclose,
		tweaks,
		onupdate
	}: {
		open: boolean;
		onopen: () => void;
		onclose: () => void;
		tweaks: Record<string, { scale: number; tilt: number; x: number; y: number }>;
		onupdate: (
			id: string,
			patch: Partial<{ scale: number; tilt: number; x: number; y: number }>
		) => void;
	} = $props();

	const INK = '#0a0a0a';
	const PAPER = '#ffffff';
	const YELLOW = '#f9bd2b';

	let posX = $state<number | null>(null);
	let posY = $state(8);

	function onMouseDown(e: MouseEvent) {
		const startX = e.clientX;
		const startY = e.clientY;
		const panel = (e.currentTarget as HTMLElement).parentElement!;
		const r = panel.getBoundingClientRect();
		const parentR = panel.offsetParent!.getBoundingClientRect();
		const startLeft = r.left - parentR.left;
		const startTop = r.top - parentR.top;

		function onMove(ev: MouseEvent) {
			posX = startLeft + (ev.clientX - startX);
			posY = startTop + (ev.clientY - startY);
		}
		function onUp() {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		e.preventDefault();
	}

	const rows = [
		{ id: 'games', label: 'GAMES', color: CATEGORIES.games.color },
		{ id: 'ent', label: 'ENT', color: CATEGORIES.ent.color },
		{ id: 'business', label: 'BUSINESS', color: CATEGORIES.business.color },
		{ id: 'counter', label: 'COUNTER', color: INK }
	];
</script>

{#if !open}
	<button class="toggle-btn" onclick={onopen}>▸ TWEAK SHELVES</button>
{:else}
	<div
		class="panel"
		style:top="{posY}px"
		style:right={posX === null ? '8px' : 'auto'}
		style:left={posX !== null ? `${posX}px` : 'auto'}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="header" onmousedown={onMouseDown}>
			<span class="header-left">
				<span class="drag-handle">⋮⋮</span>
				SHELF TWEAKS
			</span>
			<button class="close-btn" onclick={onclose}>×</button>
		</div>
		{#each rows as row (row.id)}
			{@const t = tweaks[row.id]}
			<div class="section" style:border-top="1px solid {INK}">
				<div class="section-label" style:background={row.color}>{row.label}</div>
				{#each [{ key: 'scale', min: 0.4, max: 2.2, step: 0.01 }, { key: 'tilt', min: -45, max: 45, step: 0.5 }, { key: 'x', min: -50, max: 600, step: 1 }, { key: 'y', min: 0, max: 260, step: 1 }] as slider (slider.key)}
					<div class="slider-row">
						<span class="slider-label">{slider.key.toUpperCase()}</span>
						<input
							type="range"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={t[slider.key as keyof typeof t]}
							oninput={(e) =>
								onupdate(row.id, {
									[slider.key]: parseFloat((e.currentTarget as HTMLInputElement).value)
								})}
						/>
						<input
							class="num-input"
							type="number"
							min={slider.min}
							max={slider.max}
							step={slider.step}
							value={t[slider.key as keyof typeof t]}
							oninput={(e) =>
								onupdate(row.id, {
									[slider.key]: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
								})}
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	.toggle-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 50;
		background: #0a0a0a;
		color: #f9bd2b;
		border: 2px solid #f9bd2b;
		box-shadow: 2px 2px 0 #0a0a0a;
		padding: 4px 8px;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
		cursor: pointer;
		letter-spacing: 0.04em;
	}
	.panel {
		position: absolute;
		width: 230px;
		z-index: 50;
		background: #ffffff;
		border: 2px solid #0a0a0a;
		box-shadow: 3px 3px 0 #0a0a0a;
		font-family: 'Press Start 2P', monospace;
		font-size: 8px;
	}
	.header {
		background: #0a0a0a;
		color: #f9bd2b;
		padding: 5px 8px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		letter-spacing: 0.04em;
		cursor: grab;
		user-select: none;
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.drag-handle {
		color: rgba(255, 255, 255, 0.6);
	}
	.close-btn {
		background: #ffffff;
		color: #0a0a0a;
		border: none;
		font-family: inherit;
		font-size: 8px;
		padding: 2px 5px;
		cursor: pointer;
	}
	.section {
		padding: 5px 8px;
	}
	.section-label {
		display: inline-block;
		color: #ffffff;
		padding: 2px 5px;
		margin-bottom: 4px;
		letter-spacing: 0.04em;
	}
	.slider-row {
		display: grid;
		grid-template-columns: 44px 1fr 52px;
		align-items: center;
		gap: 6px;
		padding: 1px 0;
	}
	.slider-label {
		font-size: 7px;
		letter-spacing: 0.04em;
	}
	.slider-row input[type='range'] {
		width: 100%;
		height: 14px;
	}
	.num-input {
		width: 52px;
		padding: 1px 3px;
		font-family: 'VT323', monospace;
		font-size: 13px;
		border: 1px solid #0a0a0a;
		background: #ffffff;
		color: #0a0a0a;
		text-align: right;
	}
</style>
