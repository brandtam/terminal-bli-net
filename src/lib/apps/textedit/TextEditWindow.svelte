<script lang="ts">
	import type { TerminalFS } from '$lib/terminalos';

	interface Props {
		docId: string;
		fs: TerminalFS;
	}

	let { docId, fs }: Props = $props();

	let content = $state('');
	let dirty = $state(false);

	$effect(() => {
		const text = fs.readText(docId);
		if (text !== null) {
			content = text;
			dirty = false;
		}
	});

	async function flushSave() {
		await fs.writeText(docId, content);
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

<textarea class="textedit-area" value={content} oninput={handleInput} spellcheck="false"></textarea>

<style>
	.textedit-area {
		font-family: var(--brand-font-body, 'VT323', monospace);
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
