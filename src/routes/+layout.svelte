<script lang="ts">
	import '../fonts.css';
	import '../app.css';
	import '$lib/themes/brand.css';
	import '$lib/themes/chrome.system7.css';
	import '$lib/themes/chrome.win95.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
