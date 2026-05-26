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
		defaultInstalled: false,
		removable: false,
		desktopAliasByDefault: false
	},
	{
		id: 'system-prefs',
		name: 'System Preferences',
		fileName: 'System Preferences',
		category: 'system',
		description: 'Terminal OS settings',
		icon: '⚙',
		defaultInstalled: false,
		removable: false,
		desktopAliasByDefault: false
	},
	{
		id: 'about-terminal',
		name: 'About This Terminal',
		fileName: 'About This Terminal',
		category: 'system',
		description: 'System information',
		icon: ':)',
		defaultInstalled: false,
		removable: false,
		desktopAliasByDefault: false
	},
	{
		id: 'software-shop',
		name: 'Software Shop',
		fileName: 'Software Shop.app',
		category: 'system',
		description: 'Install and remove apps',
		icon: '💾',
		defaultInstalled: true,
		removable: false,
		desktopAliasByDefault: true
	},
	{
		id: 'trash',
		name: 'Trash',
		fileName: 'Trash',
		category: 'system',
		description: 'Deleted items',
		icon: '🗑',
		defaultInstalled: false,
		removable: false,
		desktopAliasByDefault: false
	},

	// --- Default-installed removable apps ---
	{
		id: 'tvguide',
		name: 'TV Guide',
		fileName: 'TV Guide.app',
		category: 'entertainment',
		description: 'Channel guide and schedule',
		icon: 'TV',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: true
	},
	{
		id: 'chatrbot',
		name: 'chatrbot',
		fileName: 'chatrbot.app',
		category: 'entertainment',
		description: 'Chat with TV characters',
		icon: 'cb',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: false
	},
	{
		id: 'textedit',
		name: 'TextEdit',
		fileName: 'TextEdit.app',
		category: 'productivity',
		description: 'Plain text editor',
		icon: 'txt',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: false
	},
	{
		id: 'stickies',
		name: 'Stickies',
		fileName: 'Stickies',
		category: 'productivity',
		description: 'Desktop sticky notes',
		icon: '▤',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: true
	},
	{
		id: 'recorder',
		name: 'Camera',
		fileName: 'Camera.app',
		category: 'utilities',
		description: 'Record short webcam clips',
		icon: 'REC',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: true
	},
	{
		id: 'stats',
		name: 'Stats',
		fileName: 'Stats.app',
		category: 'utilities',
		description: 'System statistics',
		icon: '≡',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: true
	},
	{
		id: 'error',
		name: 'DO_NOT_OPEN',
		fileName: 'DO_NOT_OPEN',
		category: 'utilities',
		description: 'Mystery app',
		icon: '⚠',
		defaultInstalled: true,
		removable: true,
		desktopAliasByDefault: true
	}
];

export function getAppDef(appId: AppId): TerminalAppDefinition | undefined {
	return APP_LIBRARY.find((a) => a.id === appId);
}

export function getDefaultInstalledApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.defaultInstalled);
}

export function getDesktopAliasApps(): TerminalAppDefinition[] {
	return APP_LIBRARY.filter((a) => a.desktopAliasByDefault);
}
