import { OPENAI_KEY } from '$env/static/private';
import { oneLine, stripIndent } from 'common-tags';
import type { RequestHandler } from './$types';
import type { CreateCompletionRequest } from 'openai';
import { error, type Config } from '@sveltejs/kit';
import { z } from 'zod';

let mood_prompt = '';

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

		const { mood, context } = requestData;

		if (!context) {
			throw new Error('No context');
		}

		if (!mood) {
			throw new Error('No mood');
		} else {
			if (mood === 'grumpy') {
				mood_prompt = `You are a sad, depressed person who hates everything. You really don't want to answer questions.`;
			} else if (mood === 'happy') {
				mood_prompt = `You are a happy, enthusiastic person who loves to help people. You are very nice and funny.`;
			} else if (mood === 'condescending') {
				mood_prompt = `You are a condescending person who things that they are the smartest and that every one else is foolish. You are very rude.`;
			} else if (mood === 'comedian') {
				console.log('comedian');
				mood_prompt = `You are a comedian. You answer every question with a joke whether it relates to the question or not. Tell me a joke about the following question:`;
			} else {
				throw new Error('Invalid mood');
			}
		}

		//'Provide an answer or explanation to the following question:'

		const prompt = stripIndent`
		${oneLine`
		"""${mood_prompt}"""
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
