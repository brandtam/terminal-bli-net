<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';
	import { stickyFromFile, updateSticky, deleteStickyNote } from './stickies-manager.svelte';

	const COLORS: { label: string; bg: string }[] = [
		{ label: 'Yellow', bg: '#f9bd2b' },
		{ label: 'Pink', bg: '#ee63b3' },
		{ label: 'Green', bg: '#a6f000' },
		{ label: 'Blue', bg: '#6bb5ff' },
		{ label: 'Orange', bg: '#f54e00' }
	];

	// Zero-prop: the host gives us fs + this window's handle. The note id is the
	// arg the matcher parsed from `sticky:<noteId>`. The file is the source of
	// truth — read it once for the initial values.
	const { fs, window: appWindow } = getAppContext();
	const noteId = appWindow.args.noteId;

	const initial = stickyFromFile(fs.peekNode(noteId));
	// There is no UI to edit the title (only the body textarea), so it is read
	// once and written back unchanged to preserve it across saves.
	const title = initial.title;
	let bodyText = $state(initial.body);
	let color = $state(initial.color);
	let dirty = $state(false);

	function getColorDef(hex: string) {
		return COLORS.find((c) => c.bg === hex) || COLORS[0];
	}

	// COLOR is document-driven: the Color menu writes the file; reflect external
	// changes here. fs.watch is a global watcher (fires on any fs change); re-read
	// just this note's color. We do NOT re-read body — the window owns it while
	// open, so its own debounced writes never clobber in-progress typing.
	$effect(() => {
		const off = fs.watch(() => {
			color = stickyFromFile(fs.peekNode(noteId)).color;
		});
		return off;
	});

	function flushSave() {
		updateSticky(fs, { id: noteId, title, body: bodyText, color });
		dirty = false;
	}

	$effect(() => {
		if (!dirty) return;
		const _b = bodyText;
		const tid = setTimeout(() => flushSave(), 300);
		return () => {
			clearTimeout(tid);
		};
	});

	$effect(() => {
		return () => {
			if (dirty) flushSave();
		};
	});

	function handleBodyInput(e: Event) {
		bodyText = (e.target as HTMLTextAreaElement).value;
		dirty = true;
	}

	async function handleDelete() {
		await deleteStickyNote(fs, noteId);
		appWindow.close();
	}

	const colorDef = $derived(getColorDef(color));
</script>

<div class="sticky-note" style:--note-bg={colorDef.bg}>
	<div class="sticky-drag-strip" data-drag-handle>
		<button class="sticky-close" onclick={handleDelete} title="Delete note"></button>
	</div>
	<textarea class="sticky-body" value={bodyText} oninput={handleBodyInput} placeholder="type here…"
	></textarea>
</div>

<style>
	.sticky-note {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--note-bg);
		font-family: var(--brand-font-body, 'VT323', monospace);
	}
	.sticky-drag-strip {
		display: flex;
		align-items: center;
		background: var(--note-bg);
		height: 12px;
		min-height: 12px;
		padding: 0 2px;
	}
	.sticky-close {
		appearance: none;
		border: 1px solid rgba(0, 0, 0, 0.4);
		background: none;
		width: 12px;
		height: 12px;
		cursor: pointer;
		padding: 0;
	}
	.sticky-close:hover {
		background: rgba(0, 0, 0, 0.12);
	}
	.sticky-body {
		flex: 1;
		background: none;
		border: none;
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 17px;
		line-height: 1.35;
		color: var(--ink);
		padding: 2px 10px 8px;
		resize: none;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.sticky-body::placeholder {
		color: rgba(0, 0, 0, 0.35);
	}
</style>
