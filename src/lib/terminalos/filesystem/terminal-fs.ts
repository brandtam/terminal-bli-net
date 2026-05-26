import type { NodeId, FsNode, FsFolder, FsFile, FsAlias, FsResult, TerminalVolume } from './types';
import { ok, fail } from './errors';
import { generateUniqueId } from './names';
import { derivePath } from './paths';
import { getDefaultInstalledApps, getDesktopAliasApps, getAppDef } from '../apps/app-library';

// Well-known IDs
export const ROOT_ID: NodeId = 'root_terminal_hd';
export const APPLICATIONS_ID: NodeId = 'folder_applications';
export const DOCUMENTS_ID: NodeId = 'folder_documents';
export const DESKTOP_ID: NodeId = 'folder_desktop';
export const SYSTEM_ID: NodeId = 'folder_system';
export const RECORDINGS_ID: NodeId = 'folder_recordings';
export const TRASH_ID: NodeId = 'folder_trash';

const VOLUME_ID = 'volume_terminal_hd';

const README_CONTENT = `README.TXT — Terminal v1.0

Terminal is a desktop OS that lives in a browser tab. Apps run inside it.
You drag windows. You open the menu bar. You change the timezone by clicking the clock.
The whole thing is meant to feel like a computer from 1995 that someone restored for you.

NAVIGATION
- Double-click a desktop icon to open it
- Drag the title bar to move a window
- Drag the grow box (bottom-right or top-right) to resize
- Click a window to bring it forward
- x in the top-left closes it

KEYBOARD SHORTCUTS
- Cmd+N open the default app for whatever's focused
- Cmd+W close the front window
- Cmd+, open Tweaks (preferences)

THE CLOCK
Top-right of the menu bar. Click it to change timezone. Every time-aware
app reads from this clock, so changing it changes everything.

APPS
Each app on this desktop is its own thing. Click on an app's window, look at the menu bar.
The menus change to match. Open the app's Help menu to find its preferences and
its "About" page. That's where the app-specific manual lives — not here.

FAQ
What's the deal with the airing rule? Open chatrbot's Help menu.
Where's my data? localStorage. There is no server. Closing the tab loses nothing; clearing site data loses everything.
Why does it look like this? Because we like it.`;

const PRICING_CONTENT = `Pricing.txt

BASIC — $0
- 20 messages / day
- Sitcoms only (Seinfeld, Office, Friends)
- Solo characters
- Watermark on shareable transcripts

PRO — $5/mo
- Unlimited messages
- Full roster (incl. Succession, prestige drama, anti-heroes)
- Group chats — up to 4 characters at once
- Custom scene prompts ("you're stuck in an elevator")
- Export to .txt with a CRT scanline filter

SHOWRUNNER — $29/mo
- Everything in Pro
- Upload your own bible (PDF / fan wiki) → make your own cast
- API access · 100k tokens/day
- Priority during Emmy season

Cancel any time. Pricing in fake dollars. Real dollars also fine.`;

/** Apps that exist as concepts (shell, folder) but not as installable file nodes. */
const NON_FILE_APPS = new Set(['finder', 'trash']);

/** System apps that go in /System instead of /Applications. */
const SYSTEM_FOLDER_APPS = new Set(['system-prefs', 'about-terminal']);

/** IDs of system-folder apps that are always seeded regardless of defaultInstalled. */
const SYSTEM_FOLDER_APP_IDS = ['system-prefs', 'about-terminal'];

export class TerminalFS {
	private volume: TerminalVolume;
	private nodes: Map<NodeId, FsNode>;

	private constructor(volume: TerminalVolume, nodes: Map<NodeId, FsNode>) {
		this.volume = volume;
		this.nodes = nodes;
	}

	static createCleanDisk(): TerminalFS {
		const now = Date.now();
		const nodes = new Map<NodeId, FsNode>();

		// 1. Volume
		const volume: TerminalVolume = {
			id: VOLUME_ID,
			name: 'Terminal HD',
			kind: 'local',
			rootNodeId: ROOT_ID
		};

		// 2. Root folder
		const root: FsFolder = {
			id: ROOT_ID,
			volumeId: VOLUME_ID,
			kind: 'folder',
			parentId: null,
			name: 'Terminal HD',
			flags: { system: true, protected: true },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(ROOT_ID, root);

		// 3. System folders
		const systemFolders: { id: NodeId; name: string }[] = [
			{ id: APPLICATIONS_ID, name: 'Applications' },
			{ id: DOCUMENTS_ID, name: 'Documents' },
			{ id: DESKTOP_ID, name: 'Desktop' },
			{ id: SYSTEM_ID, name: 'System' },
			{ id: RECORDINGS_ID, name: 'Recordings' },
			{ id: TRASH_ID, name: 'Trash' }
		];

		for (const sf of systemFolders) {
			const folder: FsFolder = {
				id: sf.id,
				volumeId: VOLUME_ID,
				kind: 'folder',
				parentId: ROOT_ID,
				name: sf.name,
				flags: { system: true, protected: true },
				createdAt: now,
				updatedAt: now
			};
			nodes.set(sf.id, folder);
		}

		// 4. Seed app file nodes
		//    - defaultInstalled apps go into /Applications
		//    - system-folder apps (system-prefs, about-terminal) always go into /System
		//    - non-file apps (finder, trash) are never created as files
		const appsToSeed = [
			...getDefaultInstalledApps(),
			// System-folder apps aren't defaultInstalled (they don't go in /Applications)
			// but they always get seeded into /System
			...SYSTEM_FOLDER_APP_IDS.map((id) => getAppDef(id)).filter(Boolean)
		] as import('../apps/app-types').TerminalAppDefinition[];

		const appFileIds = new Map<string, NodeId>(); // appId -> file nodeId
		const seenAppIds = new Set<string>();

		for (const appDef of appsToSeed) {
			if (NON_FILE_APPS.has(appDef.id)) continue;
			if (seenAppIds.has(appDef.id)) continue;
			seenAppIds.add(appDef.id);

			const parentId = SYSTEM_FOLDER_APPS.has(appDef.id) ? SYSTEM_ID : APPLICATIONS_ID;
			const fileId = generateUniqueId();
			appFileIds.set(appDef.id, fileId);

			const file: FsFile = {
				id: fileId,
				volumeId: VOLUME_ID,
				kind: 'file',
				parentId,
				name: appDef.fileName,
				fileType: 'app',
				opensWith: appDef.id,
				appId: appDef.id,
				flags: {
					system: appDef.category === 'system',
					protected: !appDef.removable
				},
				createdAt: now,
				updatedAt: now
			};
			nodes.set(fileId, file);
		}

		// 5. Desktop aliases for apps with desktopAliasByDefault
		const desktopApps = getDesktopAliasApps();

		for (const appDef of desktopApps) {
			const targetFileId = appFileIds.get(appDef.id);
			if (!targetFileId) continue;

			const aliasId = generateUniqueId();
			const targetNode = nodes.get(targetFileId);
			if (!targetNode) continue;

			const targetPath = derivePath(targetFileId, nodes);

			const alias: FsAlias = {
				id: aliasId,
				volumeId: VOLUME_ID,
				kind: 'alias',
				parentId: DESKTOP_ID,
				name: appDef.fileName,
				target: {
					nodeId: targetFileId,
					originalPath: targetPath,
					originalName: appDef.fileName,
					targetKind: 'app'
				},
				createdAt: now,
				updatedAt: now
			};
			nodes.set(aliasId, alias);
		}

		// 6. Default documents
		const readmeId = generateUniqueId();
		const readmeFile: FsFile = {
			id: readmeId,
			volumeId: VOLUME_ID,
			kind: 'file',
			parentId: DOCUMENTS_ID,
			name: 'README.TXT',
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text: README_CONTENT },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(readmeId, readmeFile);

		const pricingId = generateUniqueId();
		const pricingFile: FsFile = {
			id: pricingId,
			volumeId: VOLUME_ID,
			kind: 'file',
			parentId: DOCUMENTS_ID,
			name: 'Pricing.txt',
			fileType: 'text',
			opensWith: 'textedit',
			bodyRef: { kind: 'inline-text', text: PRICING_CONTENT },
			createdAt: now,
			updatedAt: now
		};
		nodes.set(pricingId, pricingFile);

		return new TerminalFS(volume, nodes);
	}

	// --- Read-only API ---

	async getNode(nodeId: NodeId): Promise<FsResult<FsNode>> {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return fail('not_found', `Node "${nodeId}" not found`);
		}
		return ok(node);
	}

	async listFolder(folderId: NodeId): Promise<FsResult<FsNode[]>> {
		const node = this.nodes.get(folderId);
		if (!node) {
			return fail('not_found', `Node "${folderId}" not found`);
		}
		if (node.kind !== 'folder') {
			return fail('not_folder', `Node "${folderId}" is not a folder`);
		}

		const children: FsNode[] = [];
		for (const n of this.nodes.values()) {
			if (n.parentId === folderId) {
				children.push(n);
			}
		}

		// Sort: folders first, then alphabetical by name
		children.sort((a, b) => {
			const aIsFolder = a.kind === 'folder';
			const bIsFolder = b.kind === 'folder';
			if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		return ok(children);
	}

	async getPath(nodeId: NodeId): Promise<FsResult<string>> {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return fail('not_found', `Node "${nodeId}" not found`);
		}
		return ok(derivePath(nodeId, this.nodes));
	}

	getVolume(): TerminalVolume {
		return this.volume;
	}

	getAllNodes(): Map<NodeId, FsNode> {
		return new Map(this.nodes);
	}
}
