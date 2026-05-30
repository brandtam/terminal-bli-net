import type { AppId } from '../filesystem/types';

export type AppCategory = 'system' | 'entertainment' | 'productivity' | 'utilities';

export type AppStatus = 'coming-soon' | 'released' | 'deprecated';

export type TerminalAppDefinition = {
	id: AppId;
	name: string;
	fileName: string;
	category: AppCategory;
	description: string;
	icon: string;
	removable: boolean;
	desktopAliasByDefault: boolean;
	isSystem: boolean;
	/** Store-app lifecycle. Undefined for system apps. */
	status?: AppStatus;
};
