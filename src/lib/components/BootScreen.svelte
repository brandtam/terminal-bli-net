<script lang="ts">
	let {
		visible = true,
		onComplete
	}: {
		visible: boolean;
		onComplete?: () => void;
	} = $props();

	let show = $state(true);

	$effect(() => {
		if (!visible) {
			// fade-out starts via CSS class; transitionend handler cleans up
		}
	});
</script>

{#if show}
	<div
		class="boot-screen"
		class:fade-out={!visible}
		ontransitionend={() => {
			if (!visible) {
				show = false;
				onComplete?.();
			}
		}}
	>
		<div class="boot-content">
			<div class="boot-glyph">:)</div>
			<div class="boot-label">Terminal</div>
		</div>
	</div>
{/if}

<style>
	.boot-screen {
		position: fixed;
		inset: 0;
		background: var(--brand-color-ink, #0a0a0a);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 99999;
		opacity: 1;
		transition: opacity 300ms ease-out;
	}

	.boot-screen.fade-out {
		opacity: 0;
	}

	.boot-content {
		text-align: center;
		user-select: none;
	}

	.boot-glyph {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 40px;
		color: var(--brand-color-orange, #f54e00);
		margin-bottom: 24px;
		animation: spin-steps 2s steps(8) forwards;
	}

	@keyframes spin-steps {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.boot-label {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		font-size: 14px;
		color: var(--brand-color-paper, #e8e1d3);
		letter-spacing: 0.1em;
	}
</style>
