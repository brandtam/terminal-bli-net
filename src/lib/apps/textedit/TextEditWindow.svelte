<script lang="ts">
	import { onMount } from 'svelte';
	import { readFile, writeFile } from '$lib/os/filesystem';

	interface Props {
		docId: string;
	}

	let { docId }: Props = $props();

	let content = $state('');
	let dirty = $state(false);

	onMount(() => {
		const file = readFile(docId);
		if (file) {
			content = file.data;
		}
	});

	function flushSave() {
		const file = readFile(docId);
		if (file) {
			writeFile(docId, content);
		}
		dirty = false;
	}

	$effect(() => {
		if (!dirty) return;
		const _capture = content;
		const tid = setTimeout(() => flushSave(), 500);
		return () => {
			clearTimeout(tid);
		};
	});

	$effect(() => {
		return () => {
			if (dirty) flushSave();
		};
	});

	function handleInput(e: Event) {
		content = (e.target as HTMLTextAreaElement).value;
		dirty = true;
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
