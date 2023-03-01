<script lang="ts">
	import type { CreateCompletionResponse } from 'openai'
	import { SSE } from "sse.js";

	let context = ''
	let mood = 'grumpy'
	let loading = false
	let error: boolean | null = null
	let answer = ''
	let displayFormCard: boolean = true
	let displayAnswerCard: boolean = false
	let tempQuestion: string = ''
	let moods = [
		{ value: 'grumpy', text: `I'm Grumpy...` },
		{ value: 'happy', text: `I'm Happy!` },
		{ value: 'condescending', text: `I'm Condescending...` },
		{ value: 'comedian', text: `I'm a Comedian`}
	];

	const handleReset = async () => {
		loading = false
		error = false
		displayFormCard = true
		displayAnswerCard = false
		answer = ''
	}

	const handleSubmit = async () => {
		loading = true
		error = false
		displayFormCard = false
		displayAnswerCard = true
		tempQuestion = context;
		answer = ''

		const eventSource = new SSE('/api/answer', {
			headers: {
				'Content-Type': 'application/json'
			},
			payload: JSON.stringify({ mood, context })
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
	<div data-theme="dark" class="{displayFormCard ? 'block' : 'hidden'} flex flex-col items-center prose card w-96 shadow-xl text-center py-10">
		<h1 class="">Chatr Bot 5000</h1>
		<form on:submit|preventDefault={() => handleSubmit()}>
			<label class="" for="context">Ask your question.
				<!-- {#if form?.errors?.context}
					<span class="text-red-500">{form?.errors?.context}</span>
				{/if} -->
			</label>
			<select name="mood" id="mood" class="select select-primary max-w-xs h-2" bind:value={mood}>
				{#each moods as mood}
					<option value={mood.value}>
						{mood.text}
					</option>
				{/each}
			</select>
			<textarea autofocus class="mt-2 w-3/4 bg-slate-900" name="context" id="context" rows="5" bind:value={context}></textarea>
			<button class="btn w-3/4" type="submit">Ask</button>
		</form>
	</div>

	<div data-theme="dark" class="{displayAnswerCard ? 'block' : 'hidden'} flex flex-col items-center prose card w-96 shadow-xl text-center py-10">
		<h1 class="">Chatr Bot 5000</h1>
		<div class="w-3/4">
			<h2 class="mt-0">You Asked:</h2>
			<p>{tempQuestion}</p>
			<h2 class="mt-0">Answer:</h2>
			{#if loading}
				<p class="">Loading...</p>
			{:else if error}
				<p class="">Something went wrong</p>
			{:else}
				<p class="text-left">{answer}</p>
			{/if}
			<form on:submit|preventDefault={() => handleReset()}>
				<button class="btn w-full" type="submit">Start Over</button>
			</form>
		</div>

	</div>
</div>
