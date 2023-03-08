<script lang="ts">

	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import type { CreateCompletionResponse } from 'openai'
	import { SSE } from "sse.js";

	let context = ''
	let mood = 'happy'
	let loading = false
	let error: boolean | null = null
	let answer = ''
	let displayFormCard: boolean = true
	let tempQuestion: string = ''
	let moods = [
		{ value: 'happy', text: `I'm Happy!` },
		{ value: 'grumpy', text: `I'm Grumpy...` },
		{ value: 'condescending', text: `I'm Condescending...` },
		{ value: 'comedian', text: `I'm a Comedian`}
	];

	const handleReset = async () => {
		loading = false
		error = false
		displayFormCard = true
		answer = ''
	}

	const handleSubmit = async () => {
		loading = true
		error = false
		displayFormCard = false
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

<svelte:head>
  <title>ChatrBot.ai - AI with multiple personalities.</title>
  <link rel="canonical" href="https://www.chatrbot.ai/" />

	<meta name="description" content="ChatrBot 5000 is just another one of those OpenAI API projects. It will not revolutionize anything or cure your ills. But it's fun!">

  <meta property="og:title" content="ChatrBot.ai" />
  <meta property="og:type" content="website" />
  <meta property="og:description" content="ChatrBot 5000 is just another one of those OpenAI API projects. It will not revolutionize anything or cure your ills. But it's fun!" />
  <meta property="og:url" content="https://www.chatrbot.ai/" />
  <meta property="og:image" content="https://www.chatrbot.ai/preview.png" />
</svelte:head>

<Header />

<div class="flex flex-col items-center pb-10 pt-2">

	{#if displayFormCard }

		<div class="flex flex-col items-center prose w-full sm:w-3/4 shadow-xl text-center py-10">
			<h1 class="text-4xl">ChatrBot 5000</h1>
			<form on:submit|preventDefault={() => handleSubmit()}>
				<label class="" for="context">Ask me&nbsp;
				</label>
				<select name="mood" id="mood" class="select select-primary max-w-xs h-2" bind:value={mood}>
					{#each moods as mood}
						<option value={mood.value}>
							{mood.text}
						</option>
					{/each}
				</select>
				<textarea required class="mt-2 w-5/6 sm:w-3/4" name="context" id="context" rows="5" bind:value={context}></textarea>
				<button class="btn w-3/4" type="submit">Send It</button>
			</form>
		</div>

	{:else}

		<div class="flex flex-col items-center prose w-full sm:w-3/4 shadow-xl text-center py-10">
			<h1 class="">ChatrBot 5000</h1>
			<div class="w-3/4">
				<h3 class="mt-0">You Asked:</h3>
				<p>{tempQuestion}</p>
				<h3 class="mt-0 capitalize">{mood} Says:</h3>
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

	{/if}

</div>

<Footer/>
