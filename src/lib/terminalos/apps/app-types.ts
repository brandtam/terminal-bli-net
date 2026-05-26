import type { AppId } from '../filesystem/types';

export type AppCategory = 'system' | 'entertainment' | 'productivity' | 'utilities';

export type TerminalAppDefinition = {
	id: AppId;
	name: string;
	fileName: string;
	category: AppCategory;
	description: string;
	icon: string;
	defaultInstalled: boolean;
	removable: boolean;
	desktopAliasByDefault: boolean;
};
