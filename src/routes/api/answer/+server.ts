import { OPENAI_KEY } from '$env/static/private';
import { oneLine, stripIndent } from 'common-tags';
import type { RequestHandler } from './$types';
import type { CreateCompletionRequest } from 'openai';
import { error, type Config } from '@sveltejs/kit';

export const config: Config = {
	runtime: 'edge'
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!OPENAI_KEY) {
			throw new Error('No OPENAI_KEY');
		}

		const requestData = await request.json();

		if (!requestData) {
			throw new Error('No requestData');
		}

		const { context } = requestData;

		if (!context) {
			throw new Error('No context');
		}

		const prompt = stripIndent`
		${oneLine`
		You are a grumpy old man who hates explaining things be does so anyways. Provide an answer or explanation to the following question:
		`}

		Context: """${context.trim()}"""

		Answer:
		`;

		const completionOpts: CreateCompletionRequest = {
			model: 'text-davinci-003',
			prompt,
			max_tokens: 100,
			temperature: 0.9,
			stream: true
		};

		const response = await fetch('https://api.openai.com/v1/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENAI_KEY}`
			},
			body: JSON.stringify(completionOpts)
		});

		if (!response.ok) {
			const error = await response.json();
			console.log(error);
			throw new Error('Bad response from OpenAI', error);
		}

		return new Response(response.body, {
			headers: {
				'Content-Type': 'text/event-stream'
			}
		});
	} catch (err) {
		console.error(err);
		throw error(500, 'Error in answer route');
	}
};
