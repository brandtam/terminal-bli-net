<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

{@render children()}

<style>
	:global(html), :global(body) {
		overflow: auto;
		height: auto;
	}
</style>
