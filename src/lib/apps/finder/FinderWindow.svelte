<script lang="ts">
	import type { OsApi } from '$lib/os/os-api';
	import {
		list,
		getNode,
		onFsChange,
		createAlias,
		resolveAlias,
		ROOT_ID,
		TRASH_ID,
		SYSTEM_ID,
		APPS_ID,
		DESKTOP_ID,
		RECORDINGS_ID
	} from '$lib/os/filesystem';
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
	let fsRev = $state(0);

	$effect(() =>
		onFsChange(() => {
			fsRev++;
		})
	);

	const items = $derived.by(() => {
		fsRev;
		return list(currentFolderId);
	});
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
		if (node.type === 'alias') {
			const target = resolveAlias(node);
			if (target) return iconKind(target);
			return 'doc';
		}
		if (node.type === 'folder') {
			if (node.id === TRASH_ID) return 'trash';
			if (node.id === SYSTEM_ID) return 'hd';
			if (node.id === APPS_ID) return 'folder';
			if (node.id === DESKTOP_ID) return 'folder';
			if (node.id === RECORDINGS_ID) return 'floppy';
			return 'folder';
		}
		const file = node as FSFile;
		if (file.appId === 'recorder') return 'tv';
		if (file.appId === 'stickies') return 'stickies';
		if (file.appId === 'tvguide') return 'tvguide';
		if (file.appId === 'stats') return 'calc';
		if (file.appId === 'error') return 'floppy';
		if (file.appId === 'system-prefs') return 'hd';
		if (file.appId === 'about-terminal') return 'doc';
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
		if (node.type === 'alias') {
			const target = resolveAlias(node);
			if (target) handleOpen(target);
			return;
		}
		const file = node as FSFile;
		if (file.appId === 'textedit') {
			os.openWindow(`textedit-${file.id}`);
		} else if (file.appId === 'recorder') {
			os.openWindow(`recorder-${file.id}`);
		} else if (file.appId === 'stickies') {
			os.launchApp('stickies', { action: 'new' });
		} else if (file.appId === 'tvguide') {
			os.openWindow('tv-guide');
		} else if (file.appId === 'stats') {
			os.openWindow('stats');
		} else if (file.appId === 'error') {
			os.openWindow('error');
		} else if (file.appId === 'system-prefs') {
			os.openSystemPreferences();
		} else if (file.appId === 'about-terminal') {
			os.openAbout(null);
		} else {
			os.openWindow(file.id);
		}
	}

	function navigateTo(id: string) {
		currentFolderId = id;
		selectedId = null;
	}

	let contextMenuNode = $state<FSNode | null>(null);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);

	function handleContextMenu(e: MouseEvent, node: FSNode) {
		e.preventDefault();
		contextMenuNode = node;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
	}

	function closeContextMenu() {
		contextMenuNode = null;
	}

	function handleContextOpen() {
		if (!contextMenuNode) return;
		handleOpen(contextMenuNode);
		closeContextMenu();
	}

	function handleContextMakeAlias() {
		if (!contextMenuNode) return;
		const name = contextMenuNode.name + ' alias';
		try {
			createAlias(currentFolderId, name, contextMenuNode.id);
		} catch {
			// alias already exists or other error
		}
		closeContextMenu();
	}
</script>

<svelte:window onclick={closeContextMenu} />

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
				oncontextmenu={(e) => handleContextMenu(e, node)}
			>
				<div class="finder-item-icon">
					<PixelIcon kind={iconKind(node)} accent={iconAccent(node)} />
				</div>
				{#if node.type === 'alias'}
					<span class="alias-badge">&#x21A9;</span>
				{/if}
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

	{#if contextMenuNode}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="context-menu"
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="context-menu-item" onclick={handleContextOpen}>Open</div>
			{#if contextMenuNode.type === 'file'}
				<div class="context-menu-sep"></div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="context-menu-item" onclick={handleContextMakeAlias}>Make Alias</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.finder {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--paper, #fff);
		font-family: var(--brand-font-body, 'VT323', monospace);
	}

	.finder-path {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px 10px;
		border-bottom: 2px solid var(--ink, #0a0a0a);
		background: var(--paper-soft, #f5f0e8);
		min-height: 28px;
		flex-shrink: 0;
		overflow-x: auto;
	}

	.path-crumb {
		font-family: var(--brand-font-display, 'Press Start 2P', monospace);
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
		border-radius: 0;
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

	.alias-badge {
		font-size: 10px;
		line-height: 1;
		margin-top: -6px;
		color: var(--ink, #0a0a0a);
		opacity: 0.6;
	}

	.finder-item-label {
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
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
		border-top: 2px solid var(--ink, #0a0a0a);
		font-family: var(--brand-font-body, 'VT323', monospace);
		font-size: 16px;
		color: var(--ink, #0a0a0a);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.context-menu {
		position: fixed;
		background: var(--chrome-menubar-bg, var(--paper));
		color: var(--chrome-menubar-fg, var(--ink));
		border: 2px solid var(--chrome-window-border-color, var(--ink));
		box-shadow: 3px 3px 0 var(--shadow);
		min-width: 160px;
		padding: 4px 0;
		font-family: var(--brand-font-ui, 'Pixelify Sans', sans-serif);
		font-size: 14px;
		z-index: 12000;
	}

	.context-menu-item {
		padding: 4px 12px;
		cursor: pointer;
	}

	.context-menu-item:hover {
		background: var(--chrome-menubar-hover-bg, var(--ink));
		color: var(--chrome-menubar-hover-fg, var(--paper));
	}

	.context-menu-sep {
		height: 1px;
		background: var(--chrome-menubar-fg, var(--ink));
		margin: 4px 8px;
		opacity: 0.2;
	}
</style>
