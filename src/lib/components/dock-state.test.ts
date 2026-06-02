import { describe, it, expect } from 'vitest';
import type { InstalledApp } from '$lib/terminalos';
import type { WindowState } from '$lib/types';
import { deriveDockOpenIds } from './dock-state';

function win(id: string, z = 1): WindowState {
	return { id, x: 0, y: 0, w: 100, h: 100, z };
}

function app(id: string, windowId?: string): InstalledApp {
	return { id, name: id, icon: id.slice(0, 2), windowId };
}

describe('deriveDockOpenIds', () => {
	it('keeps raw window ids for fixed Dock indicators', () => {
		expect(deriveDockOpenIds([win('tv-guide')], [app('tvguide', 'tv-guide')])).toContain(
			'tv-guide'
		);
	});

	it('marks fixed-window installed apps active by owning app id', () => {
		expect(deriveDockOpenIds([win('tv-guide')], [app('tvguide', 'tv-guide')])).toContain('tvguide');
	});

	it('marks custom-launch installed apps active when they own a prefix window', () => {
		const openIds = deriveDockOpenIds(
			[win('textedit:file-1'), win('sticky:note-1'), win('chat:seinfeld')],
			[app('textedit'), app('stickies'), app('chatrbot')]
		);

		expect(openIds).toContain('textedit');
		expect(openIds).toContain('stickies');
		expect(openIds).toContain('chatrbot');
	});

	it('does not mark installed apps active when no owned window is open', () => {
		expect(deriveDockOpenIds([win('finder')], [app('textedit')])).not.toContain('textedit');
	});
});
