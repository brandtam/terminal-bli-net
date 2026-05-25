import { DOCS_ID, APPS_ID, exists, createFile } from '$lib/os/filesystem';

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

/**
 * Seeds default files into the Documents folder if they don't already exist.
 * Call once from Desktop's onMount.
 */
export function seedFilesystem(): void {
	if (!exists(DOCS_ID, 'README.TXT')) {
		createFile(DOCS_ID, 'README.TXT', 'textedit', README_CONTENT);
	}
	if (!exists(DOCS_ID, 'Pricing.txt')) {
		createFile(DOCS_ID, 'Pricing.txt', 'textedit', PRICING_CONTENT);
	}

	const apps = [
		{ name: 'TV Guide.app', appId: 'tvguide' },
		{ name: 'Stickies', appId: 'stickies' },
		{ name: 'Camera.app', appId: 'recorder' },
		{ name: 'Stats.app', appId: 'stats' },
		{ name: 'DO_NOT_OPEN', appId: 'error' }
	];
	for (const app of apps) {
		if (!exists(APPS_ID, app.name)) {
			createFile(APPS_ID, app.name, app.appId, '');
		}
	}
}
