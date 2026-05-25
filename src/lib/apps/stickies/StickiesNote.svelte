<script lang="ts">
	export interface StickyNote {
		id: string;
		title: string;
		body: string;
		color: string;
	}

	const COLORS: { label: string; bg: string; header: string }[] = [
		{ label: 'Yellow', bg: '#f9bd2b', header: '#d4a020' },
		{ label: 'Pink', bg: '#ee63b3', header: '#c44e94' },
		{ label: 'Green', bg: '#a6f000', header: '#7cb800' },
		{ label: 'Blue', bg: '#6bb5ff', header: '#4a8fd6' },
		{ label: 'Orange', bg: '#f54e00', header: '#c43e00' },
	];

	let {
		note,
		ondelete,
		onupdate,
	}: {
		note: StickyNote;
		ondelete: (id: string) => void;
		onupdate: (note: StickyNote) => void;
	} = $props();

	let bodyText = $state('');
	let titleText = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function getColorDef(hex: string) {
		return COLORS.find(c => c.bg === hex) || COLORS[0];
	}

	function save() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onupdate({ ...note, title: titleText, body: bodyText });
		}, 300);
	}

	function handleBodyInput(e: Event) {
		bodyText = (e.target as HTMLTextAreaElement).value;
		save();
	}

	function handleTitleInput(e: Event) {
		titleText = (e.target as HTMLInputElement).value;
		save();
	}

	$effect(() => {
		bodyText = note.body;
		titleText = note.title;
	});

	const colorDef = $derived(getColorDef(note.color));
</script>

<div class="sticky-note" style:--note-bg={colorDef.bg} style:--note-header={colorDef.header}>
	<div class="sticky-header">
		<input
			class="sticky-title"
			value={titleText}
			oninput={handleTitleInput}
			placeholder="untitled"
		/>
		<button class="sticky-close" onclick={() => ondelete(note.id)} title="Delete note">×</button>
	</div>
	<textarea
		class="sticky-body"
		value={bodyText}
		oninput={handleBodyInput}
		placeholder="type here…"
	></textarea>
</div>

<style>
	.sticky-note {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--note-bg);
		font-family: 'VT323', monospace;
	}
	.sticky-header {
		display: flex;
		align-items: center;
		background: var(--note-header);
		padding: 4px 6px;
		gap: 4px;
		min-height: 24px;
	}
	.sticky-title {
		flex: 1;
		background: none;
		border: none;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		color: #0a0a0a;
		outline: none;
		padding: 2px 0;
		min-width: 0;
	}
	.sticky-title::placeholder {
		color: rgba(0, 0, 0, 0.4);
	}
	.sticky-close {
		appearance: none;
		border: 1px solid rgba(0, 0, 0, 0.3);
		background: rgba(255, 255, 255, 0.25);
		width: 16px;
		height: 16px;
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		color: #0a0a0a;
	}
	.sticky-close:hover {
		background: rgba(255, 255, 255, 0.5);
	}
	.sticky-body {
		flex: 1;
		background: none;
		border: none;
		font-family: 'VT323', monospace;
		font-size: 17px;
		line-height: 1.35;
		color: #0a0a0a;
		padding: 8px 10px;
		resize: none;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.sticky-body::placeholder {
		color: rgba(0, 0, 0, 0.35);
	}
</style>
