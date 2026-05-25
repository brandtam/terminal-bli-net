import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		files: ['**/*.ts', '**/*.js'],
		languageOptions: {
			parser: tsParser,
			globals: {
				console: 'readonly',
				setTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				clearTimeout: 'readonly',
				fetch: 'readonly',
				Response: 'readonly',
				Request: 'readonly',
				ReadableStream: 'readonly',
				TextEncoder: 'readonly',
				TextDecoder: 'readonly',
				URL: 'readonly',
				crypto: 'readonly',
				Intl: 'readonly',
				localStorage: 'readonly',
				window: 'readonly',
				document: 'readonly',
				navigator: 'readonly',
				HTMLElement: 'readonly',
				Event: 'readonly',
				KeyboardEvent: 'readonly',
				MouseEvent: 'readonly',
				PointerEvent: 'readonly',
				EventSource: 'readonly',
				CustomEvent: 'readonly',
				ResizeObserver: 'readonly',
				requestAnimationFrame: 'readonly',
				KVNamespace: 'readonly'
			}
		},
		plugins: {
			'@typescript-eslint': ts
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-unused-vars': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser
			},
			globals: {
				console: 'readonly',
				setTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				clearTimeout: 'readonly',
				fetch: 'readonly',
				Response: 'readonly',
				Request: 'readonly',
				ReadableStream: 'readonly',
				TextEncoder: 'readonly',
				TextDecoder: 'readonly',
				URL: 'readonly',
				crypto: 'readonly',
				Intl: 'readonly',
				localStorage: 'readonly',
				window: 'readonly',
				document: 'readonly',
				navigator: 'readonly',
				HTMLElement: 'readonly',
				HTMLDivElement: 'readonly',
				HTMLInputElement: 'readonly',
				HTMLTextAreaElement: 'readonly',
				Event: 'readonly',
				KeyboardEvent: 'readonly',
				MouseEvent: 'readonly',
				PointerEvent: 'readonly',
				EventSource: 'readonly',
				CustomEvent: 'readonly',
				ResizeObserver: 'readonly',
				requestAnimationFrame: 'readonly',
				cancelAnimationFrame: 'readonly',
				performance: 'readonly'
			}
		},
		rules: {
			'no-unused-vars': 'off',
			'svelte/valid-compile': 'warn'
		}
	},
	{
		ignores: ['.svelte-kit/', 'build/', 'node_modules/', 'static/', 'bots/', 'scripts/']
	}
];
