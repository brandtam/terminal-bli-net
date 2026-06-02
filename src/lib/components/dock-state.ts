import type { WindowState } from '$lib/types';
import type { InstalledApp } from '$lib/terminalos';
import { matchWindow } from '$lib/terminalos/apps/app-catalog';

export function deriveDockOpenIds(windows: WindowState[], installedApps: InstalledApp[]): string[] {
	const ids = new Set(windows.map((w) => w.id));
	for (const app of installedApps) {
		if (windows.some((w) => matchWindow(w.id)?.appId === app.id)) ids.add(app.id);
	}
	return [...ids];
}
