<script lang="ts">
	let { w, h, shade = 'light' }: { w: number; h: number; shade?: 'light' | 'dark' } = $props();

	const bg = $derived(shade === 'dark' ? '#a88848' : '#c8a06a');
</script>

<div class="cardboard" style:width="{w}px" style:height="{h}px" style:background={bg}>
	<div class="tape"></div>
	<div class="seam"></div>
</div>

<style>
	.cardboard {
		border: 2px solid #0a0a0a;
		position: relative;
		flex-shrink: 0;
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
	}
	.tape {
		position: absolute;
		left: 0;
		right: 0;
		top: 40%;
		height: 1px;
		background: #7a4f2a;
	}
	.seam {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background: #7a4f2a;
	}
</style>
