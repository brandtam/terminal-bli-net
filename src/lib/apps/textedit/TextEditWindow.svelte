<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';

	// Zero-prop: fs + this window's handle come from the host context; the document
	// id is the matcher-parsed arg from textedit:<fileId>. (Slice 6 migration.)
	const { fs, window: appWindow } = getAppContext();
	const docId = appWindow.args.fileId;

	// docId is fixed for this window (the matcher-parsed arg never changes), so the
	// document is read once at init, not in an $effect — there's nothing to react to.
	// Edits live in `content`; external file changes aren't synced (nothing else
	// edits an open TextEdit document).
	let content = $state(fs.readText(docId) ?? '');
	let dirty = $state(false);

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
