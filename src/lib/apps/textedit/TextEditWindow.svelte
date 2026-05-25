<script lang="ts">
	import { onMount } from 'svelte';
	import { getDoc, saveDoc } from './textedit-docs';

	interface Props {
		docId: string;
	}

	let { docId }: Props = $props();

	let content = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		const doc = getDoc(docId);
		if (doc) {
			content = doc.content;
		}
	});

	function handleInput(e: Event) {
		content = (e.target as HTMLTextAreaElement).value;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			const doc = getDoc(docId);
			if (doc) {
				saveDoc({ ...doc, content, updatedAt: Date.now() });
			}
		}, 500);
	}
</script>

<textarea
	class="textedit-area"
	value={content}
	oninput={handleInput}
	spellcheck="false"
></textarea>

<style>
	.textedit-area {
		font-family: 'VT323', monospace;
		font-size: 18px;
		background: var(--paper);
		color: var(--ink);
		border: none;
		resize: none;
		padding: 14px;
		width: 100%;
		height: 100%;
		outline: none;
		line-height: 1.35;
		box-sizing: border-box;
	}
</style>
