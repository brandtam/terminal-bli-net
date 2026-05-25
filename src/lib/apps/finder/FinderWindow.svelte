<script lang="ts">
	import type { OsApi } from '$lib/os/os-api';
	import { list, getNode, ROOT_ID, TRASH_ID, SYSTEM_ID, APPS_ID, RECORDINGS_ID } from '$lib/os/filesystem';
	import type { FSNode, FSFile } from '$lib/os/filesystem';
	import PixelIcon from '$lib/components/PixelIcon.svelte';

	let {
		folderId: initialFolderId = ROOT_ID,
		os
	}: {
		folderId?: string;
		os: OsApi;
	} = $props();

	let currentFolderId = $state(initialFolderId);
	let selectedId = $state<string | null>(null);

	const items = $derived(list(currentFolderId));
	const pathSegments = $derived.by(() => {
		const segments: { id: string; name: string }[] = [];
		let node = getNode(currentFolderId);
		while (node) {
			segments.unshift({ id: node.id, name: node.name });
			node = node.parentId ? getNode(node.parentId) : null;
		}
		return segments;
	});

	function iconKind(node: FSNode): string {
		if (node.type === 'folder') {
			if (node.id === TRASH_ID) return 'trash';
			if (node.id === SYSTEM_ID) return 'hd';
			if (node.id === APPS_ID) return 'folder';
			if (node.id === RECORDINGS_ID) return 'floppy';
			return 'folder';
		}
		// File
		const file = node as FSFile;
		if (file.appId === 'recorder') return 'floppy';
		return 'doc';
	}

	function iconAccent(node: FSNode): boolean {
		if (node.type === 'file') {
			const file = node as FSFile;
			if (file.name.toLowerCase() === 'pricing.txt') return true;
		}
		return false;
	}

	function handleSelect(id: string) {
		selectedId = id;
	}

	function handleOpen(node: FSNode) {
		if (node.type === 'folder') {
			currentFolderId = node.id;
			selectedId = null;
			return;
		}
		// File - open in owning app
		const file = node as FSFile;
		if (file.appId === 'textedit') {
			os.openWindow(`textedit-${file.id}`);
		} else if (file.appId === 'recorder') {
			os.openWindow(`recorder-${file.id}`);
		} else {
			os.openWindow(file.id);
		}
	}

	function navigateTo(id: string) {
		currentFolderId = id;
		selectedId = null;
	}
</script>

<div class="finder">
	<div class="finder-path">
		{#each pathSegments as seg, i}
			{#if i > 0}<span class="path-sep">&#x25B8;</span>{/if}
			<button class="path-crumb" onclick={() => navigateTo(seg.id)}>
				{seg.name}
			</button>
		{/each}
	</div>

	<div class="finder-grid">
		{#each items as node (node.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="finder-item"
				class:selected={selectedId === node.id}
				onclick={() => handleSelect(node.id)}
				ondblclick={() => handleOpen(node)}
			>
				<div class="finder-item-icon">
					<PixelIcon kind={iconKind(node)} accent={iconAccent(node)} />
				</div>
				<div class="finder-item-label">{node.name}</div>
			</div>
		{/each}
		{#if items.length === 0}
			<div class="finder-empty">This folder is empty</div>
		{/if}
	</div>

	<div class="finder-status">
		{items.length} item{items.length !== 1 ? 's' : ''}
	</div>
</div>

<style>
	.finder {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--paper, #fff);
		font-family: 'VT323', monospace;
	}

	.finder-path {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 10px;
		border-bottom: 1px solid var(--ink, #0a0a0a);
		background: var(--paper-soft, #f5f0e8);
		min-height: 28px;
		flex-shrink: 0;
		overflow-x: auto;
	}

	.path-crumb {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		background: none;
		border: none;
		padding: 2px 4px;
		cursor: pointer;
		color: var(--ink, #0a0a0a);
		white-space: nowrap;
	}

	.path-crumb:hover {
		background: var(--ink, #0a0a0a);
		color: var(--paper, #fff);
	}

	.path-sep {
		font-size: 10px;
		opacity: 0.5;
		color: var(--ink, #0a0a0a);
	}

	.finder-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(auto-fill, 90px);
		grid-auto-rows: min-content;
		gap: 8px;
		padding: 14px;
		overflow-y: auto;
		align-content: start;
	}

	.finder-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		cursor: pointer;
		border-radius: 2px;
	}

	.finder-item:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.finder-item.selected {
		background: var(--ink, #0a0a0a);
	}

	.finder-item.selected .finder-item-label {
		color: var(--paper, #fff);
	}

	.finder-item-icon {
		width: 42px;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.finder-item-icon :global(.pixel-icon) {
		width: 42px;
		height: 42px;
	}

	.finder-item-label {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 11px;
		text-align: center;
		line-height: 1.2;
		word-break: break-word;
		max-width: 80px;
		color: var(--ink, #0a0a0a);
	}

	.finder-empty {
		grid-column: 1 / -1;
		text-align: center;
		padding: 40px 14px;
		font-size: 18px;
		opacity: 0.5;
		color: var(--ink, #0a0a0a);
	}

	.finder-status {
		padding: 4px 10px;
		border-top: 1px solid var(--ink, #0a0a0a);
		font-family: 'VT323', monospace;
		font-size: 16px;
		color: var(--ink, #0a0a0a);
		opacity: 0.7;
		flex-shrink: 0;
	}
</style>
