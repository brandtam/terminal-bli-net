<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { OsApi } from '$lib/os/os-api';
	import {
		type TerminalFS,
		ROOT_ID,
		TRASH_ID,
		SYSTEM_ID,
		APPLICATIONS_ID,
		DESKTOP_ID,
		RECORDINGS_ID,
		createFolderView
	} from '$lib/terminalos';
	import type { FsNode, FsFile, FsAlias } from '$lib/terminalos';
	import PixelIcon from '$lib/components/PixelIcon.svelte';
	import { getAppWindowId, getAppIconKind } from '$lib/terminalos/apps/app-install';
	import { getAppDef } from '$lib/terminalos/apps/app-library';
	import { isInstalled } from '$lib/terminalos/apps/software-shop';

	let {
		folderId = ROOT_ID,
		os,
		fs
	}: {
		folderId?: string;
		os: OsApi;
		fs: TerminalFS;
	} = $props();

	let currentFolderId = $state(folderId);
	let selectedId = $state<string | null>(null);

	let folderView = $state<ReturnType<typeof createFolderView> | null>(null);

	$effect(() => {
		folderView?.destroy();
		folderView = createFolderView(fs, currentFolderId);
	});

	onDestroy(() => folderView?.destroy());

	const items = $derived(folderView?.items ?? []);

	const pathSegments = $derived.by(() => {
		// Re-derive when folder contents change
		folderView?.items;
		const nodes = fs.getAllNodes();
		const segments: { id: string; name: string }[] = [];
		let node = nodes.get(currentFolderId);
		while (node) {
			segments.unshift({ id: node.id, name: node.name });
			node = node.parentId ? nodes.get(node.parentId) : undefined;
		}
		return segments;
	});

	function resolveNode(node: FsNode): FsNode | null {
		if (node.kind !== 'alias') return node;
		const alias = node as FsAlias;
		const target = fs.getAllNodes().get(alias.target.nodeId);
		if (!target) return null;
		if (target.kind === 'alias') return resolveNode(target);
		return target;
	}

	function iconKind(node: FsNode): string {
		if (node.kind === 'alias') {
			const target = resolveNode(node);
			if (target) return iconKind(target);
			return 'doc';
		}
		if (node.kind === 'folder') {
			if (node.id === TRASH_ID) return 'trash';
			if (node.id === SYSTEM_ID) return 'hd';
			if (node.id === APPLICATIONS_ID) return 'folder';
			if (node.id === DESKTOP_ID) return 'folder';
			if (node.id === RECORDINGS_ID) return 'floppy';
			return 'folder';
		}
		const file = node as FsFile;
		if (file.appId) return getAppIconKind(file.appId);
		return 'doc';
	}

	function iconAccent(node: FsNode): boolean {
		if (node.kind === 'file') {
			if (node.name.toLowerCase() === 'pricing.txt') return true;
		}
		return false;
	}

	function handleSelect(id: string) {
		selectedId = id;
	}

	function openDocFile(file: FsFile) {
		if (file.appId === 'textedit') {
			os.openWindow(`textedit-${file.id}`);
		} else if (file.appId === 'recorder') {
			os.openWindow(`recorder-${file.id}`);
		} else if (file.appId === 'stickies') {
			os.launchApp('stickies', { action: 'new' });
		}
	}

	function handleOpen(node: FsNode) {
		if (node.kind === 'folder') {
			currentFolderId = node.id;
			selectedId = null;
			return;
		}
		if (node.kind === 'alias') {
			const target = resolveNode(node);
			if (target) handleOpen(target);
			return;
		}
		const file = node as FsFile;
		const appId = file.appId;
		if (!appId) {
			os.openWindow(file.id);
			return;
		}

		// For document-type files, check if the owning app is still installed
		const docApps = new Set(['textedit', 'recorder', 'stickies']);
		if (docApps.has(appId)) {
			const appDef = getAppDef(appId);
			if (appDef) {
				const nodes = fs.getAllNodes();
				if (!isInstalled(appId, nodes)) {
					os.alert({
						title: `${appDef.name} is not installed`,
						body: `The ${appDef.name} application has been uninstalled. You can reinstall it from the Software Shop.`,
						buttons: [
							{
								label: 'Open Software Shop',
								action: () => os.openWindow('software-shop')
							},
							{ label: 'OK', primary: true }
						]
					});
				} else {
					openDocFile(file);
				}
				return;
			}
		}

		if (appId === 'system-prefs') {
			os.openSystemPreferences();
			return;
		}
		if (appId === 'about-terminal') {
			os.openAbout(null);
			return;
		}
		// Generic: look up window ID from AppLibrary
		const windowId = getAppWindowId(appId);
		if (windowId) {
			os.openWindow(windowId);
			return;
		}
		os.openWindow(file.id);
	}

	function navigateTo(id: string) {
		currentFolderId = id;
		selectedId = null;
	}

	let contextMenuNode = $state<FsNode | null>(null);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuEl = $state<HTMLDivElement | null>(null);

	function handleContextMenu(e: MouseEvent, node: FsNode) {
		e.preventDefault();
		contextMenuNode = node;
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		requestAnimationFrame(() => {
			if (!contextMenuEl) return;
			const rect = contextMenuEl.getBoundingClientRect();
			if (rect.right > window.innerWidth) contextMenuX = e.clientX - rect.width;
			if (rect.bottom > window.innerHeight) contextMenuY = e.clientY - rect.height;
		});
	}

	function closeContextMenu() {
		contextMenuNode = null;
	}

	function handleContextOpen() {
		if (!contextMenuNode) return;
		handleOpen(contextMenuNode);
		closeContextMenu();
	}

	async function handleContextMakeAlias() {
		if (!contextMenuNode) return;
		const name = contextMenuNode.name + ' alias';
		await fs.createAlias(currentFolderId, contextMenuNode.id, name);
		closeContextMenu();
	}

	const PROTECTED_IDS = new Set([
		ROOT_ID,
		SYSTEM_ID,
		APPLICATIONS_ID,
		DESKTOP_ID,
		RECORDINGS_ID,
		TRASH_ID
	]);

	function canTrash(node: FsNode): boolean {
		return !PROTECTED_IDS.has(node.id);
	}

	async function handleContextTrash() {
		if (!contextMenuNode || !canTrash(contextMenuNode)) return;
		await fs.trash(contextMenuNode.id);
		closeContextMenu();
	}

	async function handleContextDelete() {
		if (!contextMenuNode) return;
		await fs.deleteNode(contextMenuNode.id);
		closeContextMenu();
	}

	const inTrash = $derived(currentFolderId === TRASH_ID);
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
			<button
				type="button"
				class="finder-item"
				class:selected={selectedId === node.id}
				onclick={() => handleSelect(node.id)}
				ondblclick={() => handleOpen(node)}
				oncontextmenu={(e) => handleContextMenu(e, node)}
			>
				<div class="finder-item-icon" class:alias={node.kind === 'alias'}>
					<PixelIcon kind={iconKind(node)} accent={iconAccent(node)} />
				</div>
				<div class="finder-item-label">{node.name}</div>
			</button>
		{/each}
		{#if items.length === 0}
			<div class="finder-empty">This folder is empty</div>
		{/if}
	</div>

	<div class="finder-status">
		{items.length} item{items.length !== 1 ? 's' : ''}
	</div>

	{#if contextMenuNode}
		<div
			class="context-menu"
			role="menu"
			tabindex="-1"
			bind:this={contextMenuEl}
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key === 'Escape') closeContextMenu();
			}}
		>
			{#if inTrash}
				<button type="button" class="context-menu-item" onclick={handleContextDelete}
					>Delete Permanently</button
				>
			{:else}
				<button type="button" class="context-menu-item" onclick={handleContextOpen}>Open</button>
				{#if contextMenuNode.kind === 'file'}
					<div class="context-menu-sep"></div>
					<button type="button" class="context-menu-item" onclick={handleContextMakeAlias}
						>Make Alias</button
					>
				{/if}
				{#if canTrash(contextMenuNode)}
					<div class="context-menu-sep"></div>
					<button type="button" class="context-menu-item" onclick={handleContextTrash}
						>Move to Trash</button
					>
				{/if}
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
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: center;
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
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.finder-item-icon.alias::after {
		content: '\21A9';
		position: absolute;
		bottom: -2px;
		left: -2px;
		font-size: 14px;
		color: var(--ink, #0a0a0a);
		line-height: 1;
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
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
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
