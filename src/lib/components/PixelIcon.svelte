<script lang="ts">
	let {
		kind,
		color,
		accent = false
	}: {
		kind: string;
		color?: string;
		accent?: boolean;
	} = $props();
</script>

<svg viewBox="0 0 16 16" class="pixel-icon" shape-rendering="crispEdges">
	{#if kind === 'hd'}
		<rect x="2" y="13" width="13" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="1" y="3" width="14" height="10" fill="#dcd6c8" stroke="#0a0a0a" />
		<rect x="1" y="3" width="14" height="3" fill="#9b8f70" />
		<rect x="3" y="7" width="10" height="2" fill="#0a0a0a" />
		<rect x="12" y="10" width="2" height="2" fill="#a6f000" stroke="#0a0a0a" />
		<rect x="3" y="4" width="2" height="1" fill="#f54e00" />
		<rect x="5" y="4" width="2" height="1" fill="#f9bd2b" />
	{:else if kind === 'folder'}
		<rect x="1" y="13" width="14" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="1" y="3" width="6" height="2" fill="#e89c1e" stroke="#0a0a0a" />
		<rect x="1" y="4" width="14" height="9" fill="#f9bd2b" stroke="#0a0a0a" />
		<rect x="2" y="5" width="12" height="1" fill="#fff1ba" />
		<rect x="3" y="9" width="10" height="2" fill="#0a0a0a" />
		<rect x="4" y="9" width="1" height="2" fill="#f9bd2b" />
		<rect x="6" y="9" width="1" height="2" fill="#f9bd2b" />
		<rect x="8" y="9" width="1" height="2" fill="#f9bd2b" />
		<rect x="10" y="9" width="1" height="2" fill="#f9bd2b" />
		<rect x="12" y="9" width="1" height="2" fill="#f9bd2b" />
	{:else if kind === 'tv'}
		<rect x="2" y="14" width="11" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="3" y="13" width="1" height="2" fill="#0a0a0a" />
		<rect x="12" y="13" width="1" height="2" fill="#0a0a0a" />
		<rect x="1" y="3" width="14" height="11" fill="#3a322a" stroke="#0a0a0a" />
		<rect x="2" y="4" width="9" height="8" fill={color || '#a6f000'} stroke="#0a0a0a" />
		<rect x="2" y="5" width="9" height="1" fill="rgba(0,0,0,0.12)" />
		<rect x="2" y="7" width="9" height="1" fill="rgba(0,0,0,0.12)" />
		<rect x="2" y="9" width="9" height="1" fill="rgba(0,0,0,0.12)" />
		<rect x="2" y="11" width="9" height="1" fill="rgba(0,0,0,0.12)" />
		<rect x="12" y="4" width="2" height="1" fill="#cfc7b9" />
		<rect x="12" y="6" width="2" height="1" fill="#cfc7b9" />
		<rect x="12" y="8" width="2" height="1" fill="#cfc7b9" />
		<rect x="12" y="10" width="2" height="1" fill="#cfc7b9" />
		<rect x="12" y="12" width="2" height="1" fill="#f9bd2b" />
		<rect x="5" y="1" width="1" height="2" fill="#0a0a0a" />
		<rect x="10" y="1" width="1" height="2" fill="#0a0a0a" />
		<rect x="5" y="0" width="6" height="1" fill="#0a0a0a" />
	{:else if kind === 'doc'}
		<rect x="3" y="14" width="10" height="1" fill="rgba(0,0,0,0.25)" />
		<rect
			x="2"
			y="2"
			width="10"
			height="12"
			fill={accent ? '#f9bd2b' : '#ffffff'}
			stroke="#0a0a0a"
		/>
		<polygon points="10,2 12,4 10,4" fill="#dcd6c8" stroke="#0a0a0a" />
		<rect x="4" y="6" width="6" height="1" fill="#0a0a0a" />
		<rect x="4" y="8" width="6" height="1" fill="#0a0a0a" />
		<rect x="4" y="10" width="4" height="1" fill="#0a0a0a" />
		<rect x="4" y="12" width="5" height="1" fill="#0a0a0a" />
	{:else if kind === 'trash'}
		<rect x="2" y="14" width="11" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="2" y="3" width="11" height="1" fill="#0a0a0a" />
		<rect x="3" y="2" width="9" height="1" fill="#bdb6a4" stroke="#0a0a0a" />
		<rect x="6" y="1" width="3" height="1" fill="#0a0a0a" />
		<polygon points="3,4 12,4 11,14 4,14" fill="#bdb6a4" stroke="#0a0a0a" />
		<rect x="5" y="6" width="1" height="6" fill="#0a0a0a" />
		<rect x="7" y="6" width="1" height="6" fill="#0a0a0a" />
		<rect x="9" y="6" width="1" height="6" fill="#0a0a0a" />
	{:else if kind === 'calc'}
		<rect x="2" y="14" width="11" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="2" y="2" width="11" height="12" fill="#dcd6c8" stroke="#0a0a0a" />
		<rect x="3" y="3" width="9" height="3" fill="#a6f000" stroke="#0a0a0a" />
		<rect x="9" y="4" width="2" height="1" fill="#0a0a0a" />
		{#each [0, 1, 2] as r (r)}
			{#each [0, 1, 2] as c (c)}
				<rect x={3 + c * 3} y={7 + r * 2} width="2" height="1" fill="#0a0a0a" />
			{/each}
		{/each}
		<rect x="12" y="7" width="1" height="5" fill="#f54e00" stroke="#0a0a0a" />
	{:else if kind === 'floppy'}
		<rect x="2" y="14" width="12" height="1" fill="rgba(0,0,0,0.25)" />
		<rect x="2" y="2" width="12" height="12" fill="#3a322a" stroke="#0a0a0a" />
		<rect x="4" y="3" width="8" height="3" fill="#bdb6a4" stroke="#0a0a0a" />
		<rect x="6" y="3" width="1" height="3" fill="#3a322a" />
		<rect x="3" y="8" width="10" height="5" fill="#fff" stroke="#0a0a0a" />
		<rect x="4" y="9" width="4" height="1" fill="#f54e00" />
		<rect x="4" y="11" width="6" height="1" fill="#0a0a0a" />
	{:else if kind === 'stickies'}
		<rect x="2" y="14" width="12" height="1" fill="rgba(0,0,0,0.25)" />
		<!-- back note (pink) -->
		<rect x="5" y="2" width="9" height="9" fill="#ee63b3" stroke="#0a0a0a" />
		<rect x="6" y="4" width="5" height="1" fill="#0a0a0a" />
		<rect x="6" y="6" width="4" height="1" fill="#0a0a0a" />
		<!-- front note (yellow) -->
		<rect x="1" y="5" width="10" height="9" fill="#f9bd2b" stroke="#0a0a0a" />
		<rect x="1" y="5" width="10" height="2" fill="#d4a020" stroke="#0a0a0a" />
		<rect x="3" y="9" width="6" height="1" fill="#0a0a0a" />
		<rect x="3" y="11" width="5" height="1" fill="#0a0a0a" />
	{:else if kind === 'guide' || kind === 'tvguide'}
		<rect x="2" y="14" width="11" height="1" fill="rgba(0,0,0,0.25)" />
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
	{/if}
</svg>

<style>
	.pixel-icon {
		width: 52px;
		height: 52px;
		image-rendering: pixelated;
	}
</style>
