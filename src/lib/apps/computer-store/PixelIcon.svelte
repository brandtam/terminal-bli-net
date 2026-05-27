<script lang="ts">
	let { name, size = 64 }: { name: string; size?: number } = $props();
</script>

<div class="pixel-icon" style:width="{size}px" style:height="{size}px">
	{#if name === 'tetra'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="3" width="3" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="3" y="6" width="3" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="3" y="9" width="3" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="6" y="9" width="3" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="10" y="5" width="3" height="3" fill="#ff4ec8" stroke="#0a0a0a" />
			<rect x="10" y="8" width="3" height="3" fill="#ff4ec8" stroke="#0a0a0a" />
		</svg>
	{:else if name === 'card'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="4" y="2" width="9" height="12" fill="#ffffff" stroke="#0a0a0a" />
			<rect x="3" y="3" width="9" height="12" fill="#ffffff" stroke="#0a0a0a" />
			<rect x="6" y="6" width="3" height="1" fill="#0a0a0a" />
			<rect x="5" y="7" width="5" height="2" fill="#0a0a0a" />
			<rect x="4" y="9" width="7" height="1" fill="#0a0a0a" />
			<rect x="7" y="10" width="1" height="2" fill="#0a0a0a" />
			<rect x="5" y="11" width="5" height="1" fill="#0a0a0a" />
			<rect x="4" y="4" width="1" height="1" fill="#0a0a0a" />
		</svg>
	{:else if name === 'bomb'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="9" y="2" width="1" height="2" fill="#0a0a0a" />
			<rect x="10" y="3" width="1" height="1" fill="#0a0a0a" />
			<rect x="10" y="2" width="1" height="1" fill="#f9bd2b" />
			<rect x="11" y="3" width="1" height="1" fill="#f54e00" />
			<rect x="5" y="5" width="6" height="1" fill="#0a0a0a" />
			<rect x="4" y="6" width="8" height="1" fill="#0a0a0a" />
			<rect x="3" y="7" width="10" height="6" fill="#0a0a0a" />
			<rect x="4" y="13" width="8" height="1" fill="#0a0a0a" />
			<rect x="5" y="14" width="6" height="1" fill="#0a0a0a" />
			<rect x="5" y="8" width="2" height="1" fill="#7a7a7a" />
			<rect x="5" y="9" width="1" height="1" fill="#7a7a7a" />
		</svg>
	{:else if name === 'scroll'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="3" width="10" height="10" fill="#f0d8a0" stroke="#0a0a0a" />
			<rect x="2" y="3" width="2" height="2" fill="#b88a3a" stroke="#0a0a0a" />
			<rect x="2" y="11" width="2" height="2" fill="#b88a3a" stroke="#0a0a0a" />
			<rect x="12" y="3" width="2" height="2" fill="#b88a3a" stroke="#0a0a0a" />
			<rect x="12" y="11" width="2" height="2" fill="#b88a3a" stroke="#0a0a0a" />
			<rect x="5" y="6" width="6" height="1" fill="#5a3820" />
			<rect x="5" y="8" width="4" height="1" fill="#5a3820" />
			<rect x="5" y="10" width="5" height="1" fill="#5a3820" />
		</svg>
	{:else if name === 'doc'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="2" width="10" height="12" fill="#ffffff" stroke="#0a0a0a" />
			<polygon points="10,2 13,5 10,5" fill="#dcd6c8" stroke="#0a0a0a" />
			<rect x="4" y="7" width="7" height="1" fill="#0a0a0a" />
			<rect x="4" y="9" width="7" height="1" fill="#0a0a0a" />
			<rect x="4" y="11" width="5" height="1" fill="#0a0a0a" />
		</svg>
	{:else if name === 'sticky'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="3" width="9" height="9" fill="#f6c542" stroke="#0a0a0a" />
			<rect x="4" y="4" width="9" height="9" fill="#fff39a" stroke="#0a0a0a" />
			<rect x="5" y="6" width="5" height="1" fill="#0a0a0a" />
			<rect x="5" y="8" width="6" height="1" fill="#0a0a0a" />
			<rect x="5" y="10" width="3" height="1" fill="#0a0a0a" />
			<rect x="11" y="11" width="2" height="2" fill="#f6c542" />
		</svg>
	{:else if name === 'calc'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="2" width="10" height="12" fill="#dcd6c8" stroke="#0a0a0a" />
			<rect x="4" y="3" width="8" height="3" fill="#a6f000" stroke="#0a0a0a" />
			<rect x="9" y="4" width="2" height="1" fill="#0a0a0a" />
			{#each [0, 1, 2] as r}{#each [0, 1, 2] as c}<rect
						x={4 + c * 3}
						y={7 + r * 2}
						width="2"
						height="1"
						fill="#0a0a0a"
					/>{/each}{/each}
			<rect x="12" y="7" width="1" height="5" fill="#f54e00" stroke="#0a0a0a" />
		</svg>
	{:else if name === 'brush'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="1" y="7" width="7" height="6" fill="#f0c89a" stroke="#0a0a0a" />
			<rect x="2" y="8" width="1" height="1" fill="#f54e00" />
			<rect x="4" y="8" width="1" height="1" fill="#1ec8ff" />
			<rect x="6" y="8" width="1" height="1" fill="#a6f000" />
			<rect x="2" y="10" width="1" height="1" fill="#f9bd2b" />
			<rect x="4" y="10" width="1" height="1" fill="#ff4ec8" />
			<rect x="6" y="10" width="1" height="1" fill="#5a3a8a" />
			<rect x="3" y="12" width="1" height="1" fill="#0a0a0a" />
			<rect x="11" y="2" width="2" height="3" fill="#f54e00" stroke="#0a0a0a" />
			<rect x="10" y="5" width="4" height="2" fill="#b88a3a" stroke="#0a0a0a" />
			<rect x="9" y="7" width="2" height="2" fill="#7a4f2a" stroke="#0a0a0a" />
			<rect x="8" y="9" width="2" height="2" fill="#7a4f2a" stroke="#0a0a0a" />
		</svg>
	{:else if name === 'tvguide'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="3" y="13" width="1" height="2" fill="#0a0a0a" />
			<rect x="12" y="13" width="1" height="2" fill="#0a0a0a" />
			<rect x="1" y="3" width="14" height="11" fill="#3a322a" stroke="#0a0a0a" />
			<rect x="2" y="4" width="12" height="8" fill="#0000aa" stroke="#0a0a0a" />
			<rect x="3" y="5" width="2" height="1" fill="#f9bd2b" />
			<rect x="6" y="5" width="7" height="1" fill="#f9bd2b" />
			<rect x="3" y="7" width="2" height="1" fill="#f9bd2b" />
			<rect x="6" y="7" width="5" height="1" fill="#f9bd2b" />
			<rect x="3" y="9" width="2" height="1" fill="#f9bd2b" />
			<rect x="6" y="9" width="6" height="1" fill="#f9bd2b" />
			<rect x="9" y="6" width="1" height="1" fill="#a6f000" />
			<rect x="9" y="8" width="1" height="1" fill="#a6f000" />
			<rect x="9" y="10" width="1" height="1" fill="#a6f000" />
			<rect x="5" y="1" width="1" height="2" fill="#0a0a0a" />
			<rect x="10" y="1" width="1" height="2" fill="#0a0a0a" />
			<rect x="5" y="0" width="6" height="1" fill="#0a0a0a" />
		</svg>
	{:else if name === 'cb'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="2" y="2" width="11" height="8" fill="#ffffff" stroke="#0a0a0a" />
			<rect x="3" y="10" width="3" height="2" fill="#ffffff" stroke="#0a0a0a" />
			<rect x="4" y="11" width="1" height="1" fill="#ffffff" />
			<rect x="3" y="10" width="3" height="1" fill="#ffffff" />
			<rect x="4" y="4" width="1" height="4" fill="#0a0a0a" />
			<rect x="5" y="4" width="2" height="1" fill="#0a0a0a" />
			<rect x="5" y="7" width="2" height="1" fill="#0a0a0a" />
			<rect x="8" y="4" width="1" height="4" fill="#0a0a0a" />
			<rect x="9" y="4" width="2" height="1" fill="#0a0a0a" />
			<rect x="9" y="6" width="2" height="1" fill="#0a0a0a" />
			<rect x="9" y="7" width="2" height="1" fill="#0a0a0a" />
			<rect x="11" y="5" width="1" height="1" fill="#0a0a0a" />
			<rect x="11" y="7" width="1" height="1" fill="#0a0a0a" />
		</svg>
	{:else if name === 'camera'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="2" y="5" width="9" height="7" fill="#3a322a" stroke="#0a0a0a" />
			<rect x="11" y="6" width="3" height="5" fill="#3a322a" stroke="#0a0a0a" />
			<rect x="12" y="7" width="2" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="3" y="3" width="4" height="2" fill="#3a322a" stroke="#0a0a0a" />
			<rect x="3" y="7" width="2" height="2" fill="#f54e00" stroke="#0a0a0a" />
			<rect x="6" y="3" width="1" height="2" fill="#0a0a0a" />
		</svg>
	{:else if name === 'chart'}
		<svg viewBox="0 0 16 16" shape-rendering="crispEdges">
			<rect x="2" y="3" width="1" height="11" fill="#0a0a0a" />
			<rect x="2" y="13" width="12" height="1" fill="#0a0a0a" />
			<rect x="4" y="10" width="2" height="3" fill="#1ec8ff" stroke="#0a0a0a" />
			<rect x="7" y="7" width="2" height="6" fill="#a6f000" stroke="#0a0a0a" />
			<rect x="10" y="5" width="2" height="8" fill="#f54e00" stroke="#0a0a0a" />
			<rect x="13" y="4" width="1" height="1" fill="#f9bd2b" />
		</svg>
	{/if}
</div>

<style>
	.pixel-icon {
		display: block;
	}
	.pixel-icon svg {
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
	}
</style>
