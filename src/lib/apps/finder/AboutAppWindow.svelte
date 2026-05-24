<script lang="ts">
	import type { AboutSpec } from '$lib/os/os-api';

	let { about }: { about: AboutSpec } = $props();
</script>

<div class="about-app">
	<div class="header">
		<div
			class="icon"
			style:background={about.glyphBg}
			style:color={about.glyphFg || 'var(--ink)'}
			style:font-size="{about.glyph.length > 2 ? 14 : 20}px"
		>{about.glyph}</div>
		<div>
			<div class="title">{about.title}</div>
			<div class="version">{about.version} · {about.tagline}</div>
		</div>
	</div>
	{#each about.sections as section}
		<h3>{section.h}</h3>
		<p>{section.body}</p>
	{/each}
</div>

<style>
	.about-app { padding: 14px; font-family: var(--brand-font-body, 'VT323', monospace); font-size: 18px; line-height: 1.35; }
	.header {
		display: flex;
		gap: 14px;
		align-items: center;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 12px;
		margin-bottom: 12px;
	}
	.icon {
		width: 64px;
		height: 64px;
		border: 2px solid var(--ink);
		display: grid;
		place-items: center;
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
		flex-shrink: 0;
	}
	.title { font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 14px; }
	.version { font-family: var(--brand-font-body, 'VT323', monospace); font-size: 17px; opacity: 0.8; margin-top: 4px; }
	h3 { font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 10px; margin: 14px 0 6px; font-weight: normal; }
	h3:first-of-type { margin-top: 0; }
	p { margin: 0 0 8px; }
</style>
