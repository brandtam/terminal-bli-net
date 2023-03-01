<script lang="ts">
	let footerLinks = [
		{
			name: 'OpenAI',
			url: 'https://openai.com/',
		},
		{
			name: 'SvelteKit',
			url: 'https://kit.svelte.dev/',
		},
		{
			name: 'Vercel Edge Functions',
			url: 'https://vercel.com/',
		},
	];
</script>

<footer class="text-center text-sm h-10 sm:h-20 w-full sm:pt-2 pt-4 border-t mt-5 px-3 space-y-3 sm:mb-0 mb-3">
	<div>
		Built with
		{#each footerLinks as footerLink, i}
			<a href="{footerLink.url}" target="_blank" rel="noreferrer" class="font-bold hover:underline transition underline-offset-2">
				{footerLink.name}</a>{#if i < (footerLinks.length-1)},&nbsp;{:else}.{/if}
		{/each}
	</div>
</footer>