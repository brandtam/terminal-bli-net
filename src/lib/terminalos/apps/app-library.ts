import type { AppId } from '../filesystem/types';
import type { TerminalAppDefinition } from './app-types';

export const APP_LIBRARY: TerminalAppDefinition[] = [
	// --- OS core (protected, not removable) ---
	{
		id: 'finder',
		name: 'Finder',
		fileName: 'Finder',
		category: 'system',
		description: 'File manager and desktop shell',
		icon: ':)',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},
	{
		id: 'system-prefs',
		name: 'System Preferences',
		fileName: 'System Preferences',
		category: 'system',
		description: 'Terminal OS settings',
		icon: '⚙',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},
	{
		id: 'about-terminal',
		name: 'About This Terminal',
		fileName: 'About This Terminal',
		category: 'system',
		description: 'System information',
		icon: ':)',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},
	{
		id: 'software-shop',
		name: 'My Shelf',
		fileName: 'My Shelf.app',
		category: 'system',
		description: 'Your owned apps',
		icon: '💾',
		removable: false,
		desktopAliasByDefault: true,
		isSystem: true
	},
	{
		id: 'computer-store',
		name: 'Computer Store',
		fileName: 'Computer Store.app',
		category: 'system',
		description: 'Browse and buy software',
		icon: '🏪',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},
	{
		id: 'trash',
		name: 'Trash',
		fileName: 'Trash',
		category: 'system',
		description: 'Deleted items',
		icon: '🗑',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},

	// --- System apps bundled with OS (not in the Computer Store) ---
	{
		id: 'textedit',
		name: 'TextEdit',
		fileName: 'TextEdit.app',
		category: 'productivity',
		description: 'Plain text editor',
		icon: 'txt',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true
	},
	{
		id: 'stickies',
		name: 'Stickies',
		fileName: 'Stickies',
		category: 'productivity',
		description: 'Desktop sticky notes',
		icon: '▤',
		removable: false,
		desktopAliasByDefault: true,
		isSystem: true
	},

	// --- Store apps (must be bought at the Computer Store) ---
	{
		id: 'tvguide',
		name: 'TV Guide',
		fileName: 'TV Guide.app',
		category: 'entertainment',
		description: 'Channel guide and schedule',
		icon: 'TV',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released'
	},
	{
		id: 'chatrbot',
		name: 'chatrbot',
		fileName: 'chatrbot.app',
		category: 'entertainment',
		description: 'Chat with TV characters',
		icon: 'cb',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'released'
	},
	{
		id: 'recorder',
		name: 'Camera',
		fileName: 'Camera.app',
		category: 'utilities',
		description: 'Record short webcam clips',
		icon: 'REC',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released'
	},
	{
		id: 'stats',
		name: 'Stats',
		fileName: 'Stats.app',
		category: 'utilities',
		description: 'System statistics',
		icon: '≡',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released'
	},
	{
		id: 'error',
		name: 'DO_NOT_OPEN',
		fileName: 'DO_NOT_OPEN',
		category: 'utilities',
		description: 'Mystery app',
		icon: '⚠',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released'
	},
	{
		id: 'tetra',
		name: 'Tetra',
		fileName: 'Tetra.app',
		category: 'entertainment',
		description: 'Falling block puzzle',
		icon: '▦',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'solitaire',
		name: 'Solitaire',
		fileName: 'Solitaire.app',
		category: 'entertainment',
		description: 'Card game',
		icon: '♠',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'minesweep',
		name: 'Minesweep',
		fileName: 'Minesweep.app',
		category: 'entertainment',
		description: 'Grid puzzle with bombs',
		icon: '💣',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'zorquest',
		name: 'ZorQuest',
		fileName: 'ZorQuest.app',
		category: 'entertainment',
		description: 'Text adventure',
		icon: '📜',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'calc',
		name: 'Calc.app',
		fileName: 'Calc.app',
		category: 'productivity',
		description: 'Calculator',
		icon: '🧮',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'paint',
		name: 'Pixel Paint',
		fileName: 'Pixel Paint.app',
		category: 'productivity',
		description: 'Bitmap painting',
		icon: '🖌',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon'
	},
	{
		id: 'vcr',
		name: 'VCR',
		fileName: 'VCR.app',
		category: 'entertainment',
		description: 'Retro video player',
		icon: '📼',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released'
	}
];

export function getAppDef(appId: AppId): TerminalAppDefinition | undefined {
	return APP_LIBRARY.find((a) => a.id === appId);
}

/** System apps — always owned, seeded on a clean disk. */
export function getSystemApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.isSystem);
}

export function getDesktopAliasApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.desktopAliasByDefault);
}

export function getStoreApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => !a.isSystem);
}
