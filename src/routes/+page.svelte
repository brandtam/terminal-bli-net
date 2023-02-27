<script lang="ts">
	import type { CreateCompletionResponse } from 'openai'
	import { SSE } from "sse.js";

	let context = ''
	let loading = false
	let error: boolean | null = null
	let answer = ''

	const handleSubmit = async () => {
		loading = true
		error = null
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
			alert('Something went wrong')
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
	<div class="flex flex-col items-center prose card w-96 bg-black shadow-xl text-center">
		<h1 class="text-purple-600 pt-4">Ask Me Anything</h1>
		<form on:submit|preventDefault={() => handleSubmit()}>
			<label class="text-yellow-500" for="context">What are you wondering?</label>
			<textarea class="bg-slate-200 w-3/4" name="context" id="context" rows="5" bind:value={context}></textarea>
			<button class="btn w-3/4 bg-purple-600 hover:bg-blue-600" type="submit">Ask</button>
		</form>
		<div class="w-3/4">
			<h2>Answer</h2>
			{#if loading}
				<p class="text-yellow-500">Loading...</p>
			{:else if error}
				<p class="text-yellow-500">Something went wrong</p>
			{:else}
				<p class="text-yellow-500 text-left">{answer}</p>
			{/if}
		</div>
	</div>
</div>
