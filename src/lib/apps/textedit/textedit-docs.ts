import { appRead, appWrite } from '$lib/persistence';

export interface TextDoc {
	id: string;
	name: string;
	content: string;
	updatedAt: number;
}

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

export function loadDocs(): Record<string, TextDoc> {
	const docs = appRead<Record<string, TextDoc>>('textedit', 'docs', {});
	if (Object.keys(docs).length === 0) {
		const now = Date.now();
		docs['readme'] = { id: 'readme', name: 'README.TXT', content: README_CONTENT, updatedAt: now };
		docs['pricing'] = { id: 'pricing', name: 'Pricing.txt', content: PRICING_CONTENT, updatedAt: now };
		appWrite('textedit', 'docs', docs);
	}
	return docs;
}

export function saveDoc(doc: TextDoc): void {
	const docs = loadDocs();
	docs[doc.id] = doc;
	appWrite('textedit', 'docs', docs);
}

export function getDoc(id: string): TextDoc | null {
	const docs = loadDocs();
	return docs[id] || null;
}

export function listDocs(): TextDoc[] {
	const docs = loadDocs();
	return Object.values(docs).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createDoc(name?: string): TextDoc {
	const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	const doc: TextDoc = {
		id,
		name: name || 'Untitled.txt',
		content: '',
		updatedAt: Date.now()
	};
	saveDoc(doc);
	return doc;
}
