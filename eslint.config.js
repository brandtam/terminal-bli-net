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
		files: ['**/*.ts', '**/*.js', '**/*.mjs'],
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
				confirm: 'readonly',
				process: 'readonly',
				Node: 'readonly',
				HTMLElement: 'readonly',
				Event: 'readonly',
				KeyboardEvent: 'readonly',
				MouseEvent: 'readonly',
				DragEvent: 'readonly',
				PointerEvent: 'readonly',
				DataTransfer: 'readonly',
				FormData: 'readonly',
				AbortController: 'readonly',
				AbortSignal: 'readonly',
				DOMException: 'readonly',
				DurableObjectNamespace: 'readonly',
				DurableObjectState: 'readonly',
				D1Database: 'readonly',
				R2Bucket: 'readonly',
				R2Objects: 'readonly',
				ExecutionContext: 'readonly',
				ScheduledController: 'readonly',
				WebSocket: 'readonly',
				WebSocketPair: 'readonly',
				WebSocketRequestResponsePair: 'readonly',
				Headers: 'readonly',
				BufferSource: 'readonly',
				App: 'readonly',
				RequestInit: 'readonly',
				EmailAddress: 'readonly',
				EventSource: 'readonly',
				ExportedHandler: 'readonly',
				Fetcher: 'readonly',
				ForwardableEmailMessage: 'readonly',
				CustomEvent: 'readonly',
				ResizeObserver: 'readonly',
				ResponseInit: 'readonly',
				requestAnimationFrame: 'readonly',
				KVNamespace: 'readonly',
				SendEmail: 'readonly',
				indexedDB: 'readonly',
				IDBDatabase: 'readonly',
				BroadcastChannel: 'readonly',
				MessageEvent: 'readonly',
				Blob: 'readonly',
				btoa: 'readonly',
				atob: 'readonly',
				createImageBitmap: 'readonly',
				ImageBitmap: 'readonly',
				OffscreenCanvas: 'readonly',
				OffscreenCanvasRenderingContext2D: 'readonly',
				CanvasRenderingContext2D: 'readonly',
				HTMLCanvasElement: 'readonly',
				HTMLInputElement: 'readonly',
				structuredClone: 'readonly',
				queueMicrotask: 'readonly',
				AudioContext: 'readonly',
				AudioContextState: 'readonly',
				AudioBuffer: 'readonly',
				AudioBufferSourceNode: 'readonly',
				AudioNode: 'readonly',
				AudioScheduledSourceNode: 'readonly',
				GainNode: 'readonly',
				PeriodicWave: 'readonly',
				__APP_VERSION__: 'readonly'
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
				Node: 'readonly',
				HTMLElement: 'readonly',
				HTMLDivElement: 'readonly',
				HTMLImageElement: 'readonly',
				HTMLInputElement: 'readonly',
				HTMLTextAreaElement: 'readonly',
				HTMLVideoElement: 'readonly',
				MediaStream: 'readonly',
				MediaRecorder: 'readonly',
				Blob: 'readonly',
				FileReader: 'readonly',
				Event: 'readonly',
				KeyboardEvent: 'readonly',
				MouseEvent: 'readonly',
				DragEvent: 'readonly',
				PointerEvent: 'readonly',
				DataTransfer: 'readonly',
				EventSource: 'readonly',
				CustomEvent: 'readonly',
				ResizeObserver: 'readonly',
				requestAnimationFrame: 'readonly',
				cancelAnimationFrame: 'readonly',
				performance: 'readonly',
				__APP_VERSION__: 'readonly'
			}
		},
		rules: {
			'no-unused-vars': 'off',
			'no-useless-assignment': 'off',
			'svelte/valid-compile': 'warn'
		}
	},
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			globals: {
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly'
			}
		}
	},
	{
		ignores: ['.svelte-kit/', 'build/', 'node_modules/', 'static/', 'bots/', 'scripts/', '.claude/']
	}
];
