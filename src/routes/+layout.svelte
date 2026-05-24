<script lang="ts">
	import '../app.css';
	import '$lib/tokens/brand.css';
	import '$lib/tokens/chrome.system7.css';
	import '$lib/tokens/chrome.win95.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
