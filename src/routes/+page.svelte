<script lang="ts">
	import type { CreateCompletionResponse } from 'openai'
	import { SSE } from "sse.js";

	let context = ''
	let loading = false
	let error: boolean | null = null
	let answer = ''

	export let form;

	const handleSubmit = async () => {
		loading = true
		error = false
		answer = ''

		const eventSource = new SSE('/api/answer', {
			headers: {
				'Content-Type': 'application/json'
			},
			payload: JSON.stringify({ context })
		})

		context = ''

		eventSource.addEventListener('error', (e) => {
			error = true
			loading = false
			console.log('error', e)
		})

		eventSource.addEventListener('message', (e) => {
			try {
				loading = false

				if (e.data === '[DONE]') {
					eventSource.close()
					return
				}

				const completionResponse: CreateCompletionResponse = JSON.parse(e.data)
				const [{text}] = completionResponse.choices
				answer = (answer ?? '' ) + text

			} catch (err) {
				error = true
				loading = false
				console.log(err)
				alert('Something went wrong')}
		})

		eventSource.stream()

	}
</script>

<div class="flex flex-col items-center py-10">
	<div data-theme="dark" class="flex flex-col items-center prose card w-96 shadow-xl text-center">
		<h1 class=" pt-4">Chatr Bot 5000</h1>
		<form on:submit|preventDefault={() => handleSubmit()}>
			<label class="" for="context">Ask your question. I'm grumpy.
				{#if form?.errors?.context}
					<span class="text-red-500">{form?.errors?.context}</span>
				{/if}
			</label>
			<textarea autofocus class="w-3/4 bg-slate-900" name="context" id="context" rows="5" bind:value={context}></textarea>
			<button class="btn w-3/4" type="submit">Ask</button>
		</form>
		<div class="w-3/4">
			<h2>Answer</h2>
			{#if loading}
				<p class="">Loading...</p>
			{:else if error}
				<p class="">Something went wrong</p>
			{:else}
				<p class=" text-left">{answer}</p>
			{/if}
		</div>
	</div>
</div>
