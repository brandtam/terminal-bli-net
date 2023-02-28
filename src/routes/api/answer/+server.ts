import { OPENAI_KEY } from '$env/static/private';
import { oneLine, stripIndent } from 'common-tags';
import type { RequestHandler } from './$types';
import type { CreateCompletionRequest } from 'openai';
import { error, type Config } from '@sveltejs/kit';
import { z } from 'zod';

const registerSchema = z.object({
	context: z
		.string({ required_error: 'A question must be asked.' })
		.min(10, { message: 'The minimum question size is 10 characters.' })
		.max(100, { message: 'The maximum quesion size is 100 characters.' })
		.trim()
});

export const config: Config = {
	runtime: 'edge'
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!OPENAI_KEY) {
			throw new Error('No OPENAI_KEY');
		}

		const requestData = await request.json();

		try {
			const result = registerSchema.parse(requestData);
			console.log('Success', result);
		} catch (err: unknown) {
			console.log('Failure', err.flatten());
			const { fieldErrors: errors } = err.flatten();
			throw new Error('Validation error', errors);
		}

		if (!requestData) {
			throw new Error('No requestData');
		}

		const { context } = requestData;

		if (!context) {
			throw new Error('No context');
		}

		const prompt = stripIndent`
		${oneLine`
		You are a grumpy old man who hates explaining things but you do so anyways. You are a little bit rude. Provide an answer or explanation to the following question:
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
		throw error(500, `${err}`);
	}
};
