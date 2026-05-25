<script lang="ts">
	export interface StickyNote {
		id: string;
		title: string;
		body: string;
		color: string;
	}

	const COLORS: { label: string; bg: string }[] = [
		{ label: 'Yellow', bg: '#f9bd2b' },
		{ label: 'Pink', bg: '#ee63b3' },
		{ label: 'Green', bg: '#a6f000' },
		{ label: 'Blue', bg: '#6bb5ff' },
		{ label: 'Orange', bg: '#f54e00' }
	];

	let {
		note,
		ondelete,
		onupdate
	}: {
		note: StickyNote;
		ondelete: (id: string) => void;
		onupdate: (note: StickyNote) => void;
	} = $props();

	let bodyText = $state('');
	let titleText = $state('');
	let dirty = $state(false);

	function getColorDef(hex: string) {
		return COLORS.find((c) => c.bg === hex) || COLORS[0];
	}

	function flushSave() {
		onupdate({ ...note, title: titleText, body: bodyText });
		dirty = false;
	}

	$effect(() => {
		if (!dirty) return;
		const _t = titleText;
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

	$effect(() => {
		bodyText = note.body;
		titleText = note.title;
	});

	const colorDef = $derived(getColorDef(note.color));
</script>

<div class="sticky-note" style:--note-bg={colorDef.bg}>
	<div class="sticky-drag-strip" data-drag-handle>
		<button class="sticky-close" onclick={() => ondelete(note.id)} title="Delete note"></button>
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
