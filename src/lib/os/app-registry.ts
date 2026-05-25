import type { AppDef, OsApi, AppMenuSpec } from './os-api';
import { createDoc, listDocs, findDocByName } from '$lib/apps/textedit/textedit-docs';

export const APPS: Record<string, AppDef> = {
	finder: {
		id: 'finder',
		name: 'Finder',
		filename: 'Finder',
		about: {
			title: 'Terminal',
			version: 'Version 1.0 "Pilot"',
			tagline: 'terminal.bli.net · one tab, one desktop',
			glyph: ':)',
			glyphBg: 'var(--accent-2)',
			glyphFg: 'var(--ink)',
			sections: [
				{
					h: 'WHAT',
					body: 'An operating system that runs in a tab. Windows that drag, icons you double-click, a menu bar at the top, a dock at the bottom. The aesthetic is mid-90s desktop computing, played straight.'
				},
				{
					h: 'WHY',
					body: 'Because slick web apps got boring. Because chunky borders and pixel fonts age better than gradients. Because a desktop is a place to keep things, and the web mostly stopped doing that.'
				},
				{
					h: 'APPS',
					body: "Terminal ships with a few apps. Each one is its own thing — open an app's window, then look at the menu bar; it changes to match the focused app. Each app keeps its own About and Preferences under its Help menu. Lore lives there, not here."
				},
				{ h: 'WHO', body: "One person, an old iMac G3 they don't actually own. Ships on Sundays." },
				{ h: 'CREDITS', body: 'The people who made early Mac OS. You, for hanging out.' }
			]
		},
		preferences: null,
		menus: (os) => [
			{
				label: 'File',
				items: [
					{ type: 'action', label: 'New Folder', shortcut: '⌘N', disabled: true },
					{
						type: 'action',
						label: 'New Text Document',
						shortcut: '⌘T',
						action: () => {
							const doc = createDoc();
							os.openWindow(`textedit-${doc.id}`);
						}
					},
					{ type: 'separator' },
					{ type: 'action', label: 'Get Info', disabled: true },
					{ type: 'action', label: 'Sleep (good luck)', disabled: true }
				]
			},
			{
				label: 'Edit',
				items: [
					{ type: 'action', label: 'Undo', shortcut: '⌘Z', disabled: true },
					{ type: 'action', label: 'Cut', shortcut: '⌘X', disabled: true },
					{ type: 'action', label: 'Copy', shortcut: '⌘C', disabled: true },
					{ type: 'action', label: 'Paste', shortcut: '⌘V', disabled: true }
				]
			},
			{
				label: 'View',
				items: [
					{ type: 'action', label: 'as Icons', disabled: true },
					{ type: 'action', label: 'as List', disabled: true },
					{ type: 'separator' },
					{ type: 'action', label: 'Show Stats', action: () => os.openWindow('stats') },
					{
						type: 'action',
						label: 'Show Pricing',
						action: () => {
							const f = findDocByName('Pricing.txt');
							if (f) os.openWindow(`textedit-${f.id}`);
						}
					}
				]
			},
			{
				label: 'Special',
				items: [
					{ type: 'action', label: 'Empty Trash', disabled: true },
					{ type: 'separator' },
					{ type: 'action', label: 'Restart', action: () => os.openWindow('error') },
					{ type: 'action', label: "Shut Down (don't)", action: () => os.openWindow('error') }
				]
			},
			{
				label: 'Help',
				items: [
					{ type: 'action', label: 'About Terminal', action: () => os.openAbout(null) },
					{
						type: 'action',
						label: 'README.txt',
						action: () => {
							const f = findDocByName('README.TXT');
							if (f) os.openWindow(`textedit-${f.id}`);
						}
					}
				]
			}
		],
		statusExtra: () => null
	},

	tvguide: {
		id: 'tvguide',
		name: 'TV Guide',
		filename: 'TV Guide.app',
		about: {
			title: 'TV Guide',
			version: 'v1.0',
			tagline: 'the scheduling app for Terminal',
			glyph: 'TV',
			glyphBg: '#0000aa',
			glyphFg: '#f9bd2b',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'The cable guide. Six channels, 48 half-hour slots, twenty-four hours of programming scrolling right-to-left like the real Prevue Channel did in 1995.'
				},
				{
					h: 'HOW TO USE IT',
					body: "Single click a show to preview it in the top pane. Double click a show that's on now to start a chatrbot conversation. Wait for off-air shows to come on — the schedule rolls forward in real time. Change your timezone by clicking the OS clock; the guide follows."
				},
				{
					h: "WHAT IT DOESN'T DO",
					body: "It doesn't let you skip ahead. It doesn't pick favorites. It runs whatever's scheduled."
				},
				{
					h: 'CREDITS',
					body: "The Prevue Channel. NBC's 'Must See TV' graphics circa 1996. The font designers who made VT323 free."
				}
			]
		},
		preferences: 'tvguide-prefs',
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New Guide Window',
						shortcut: '⌘N',
						action: () => os.openWindow('tv-guide')
					},
					{ type: 'action', label: 'Close Window', shortcut: '⌘W', action: () => os.closeFocused() }
				]
			},
			{
				label: 'Shows',
				items: os.guide.shows().map((s) => ({
					type: 'action' as const,
					label: `${s.name}${s.onAir ? '' : '  (off air)'}`,
					disabled: !s.onAir,
					action: () => os.launchApp('chatrbot', { showId: s.id })
				}))
			},
			{
				label: 'View',
				items: [
					{ type: 'action', label: 'Jump to Live', shortcut: '⌘L', disabled: true },
					{ type: 'separator' },
					{
						type: 'check',
						label: 'Pause on hover',
						checked: os.tweaks.tvPauseOnHover,
						toggle: () => os.setTweak('tvPauseOnHover', !os.tweaks.tvPauseOnHover)
					}
				]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'Preferences…',
						shortcut: '⌘,',
						action: () => os.openPreferences('tvguide')
					},
					{ type: 'separator' },
					{ type: 'action', label: 'About TV Guide', action: () => os.openAbout('tvguide') },
					{
						type: 'action',
						label: 'How airing works',
						action: () => {
							const f = findDocByName('README.TXT');
							if (f) os.openWindow(`textedit-${f.id}`);
						}
					}
				]
			}
		],
		statusExtra: (os) => {
			const count = os.guide.liveCount();
			if (count === 0) return null;
			return { label: `${count} LIVE`, kind: 'live' };
		}
	},

	chatrbot: {
		id: 'chatrbot',
		name: 'chatrbot',
		filename: 'chatrbot.app',
		about: {
			title: 'chatrbot',
			version: 'v1.0',
			tagline: 'the chat app inside Terminal',
			glyph: 'cb',
			glyphBg: 'var(--accent)',
			glyphFg: 'var(--paper)',
			sections: [
				{
					h: 'WHAT IT DOES',
					body: "chatrbot lets you talk to AI versions of characters from shows people can't shut up about. Jerry, Michael, Logan Roy. Sometimes too in character. They'll text back."
				},
				{
					h: 'THE RULE',
					body: "You can only chat with characters from a show that is currently broadcasting on the TV Guide. If The Office isn't on right now, you can't text Michael. Wait for the next airing — like real TV. This is the point of the whole thing. Scarcity is the feature."
				},
				{
					h: "WHAT IT WON'T DO",
					body: "Characters will not break the fourth wall. They will not write your essay. They will not be polite if their character isn't polite. Some of them will be mean to you. That's between you and the character, not you and us."
				},
				{
					h: 'CREDITS',
					body: 'The cast and crew of every show we lovingly satirize. Anthropic, for the engine. You, for hanging out.'
				}
			]
		},
		preferences: 'chatrbot-prefs',
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New Conversation',
						shortcut: '⌘N',
						action: () => os.startNewConversation()
					},
					{
						type: 'action',
						label: 'Close Conversation',
						shortcut: '⌘W',
						action: () => os.closeFocused()
					},
					{ type: 'separator' },
					{ type: 'action', label: 'Browse TV Guide', action: () => os.openWindow('tv-guide') }
				]
			},
			{
				label: 'Conversation',
				items: [
					{ type: 'action', label: 'Clear transcript', disabled: true },
					{ type: 'action', label: 'Export as .txt', disabled: true },
					{ type: 'separator' },
					{ type: 'action', label: 'End chat (politely)', action: () => os.closeFocused() }
				]
			},
			{
				label: 'View',
				items: [
					{ type: 'action', label: 'Show timestamps', disabled: true },
					{ type: 'action', label: 'Compact bubbles', disabled: true }
				]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'Preferences…',
						shortcut: '⌘,',
						action: () => os.openPreferences('chatrbot')
					},
					{
						type: 'action',
						label: "Why can't I chat now?",
						action: () =>
							os.alert({
								title: 'The airing rule',
								body: "You can only chat with characters from shows that are currently broadcasting. Wait for your show to come on — like real TV. The TV Guide tells you what's on.",
								buttons: [{ label: 'Got it', primary: true }]
							})
					},
					{ type: 'separator' },
					{ type: 'action', label: 'About chatrbot', action: () => os.openAbout('chatrbot') }
				]
			}
		],
		statusExtra: () => null
	},

	stats: {
		id: 'stats',
		name: 'Stats',
		filename: 'Stats.app',
		about: {
			title: 'Stats',
			version: 'v0.1',
			tagline: 'the very simple stats app',
			glyph: '≡',
			glyphBg: 'var(--paper-soft)',
			glyphFg: 'var(--ink)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'A very simple stats app. Currently shows placeholders; eventually it might pull real numbers from analytics. Undecided.'
				},
				{
					h: 'ACCURACY',
					body: "None of these numbers are accurate. They are jokes. Don't quote us."
				}
			]
		},
		preferences: null,
		menus: (os) => [
			{
				label: 'File',
				items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
			},
			{
				label: 'View',
				items: [{ type: 'action', label: 'Refresh (does nothing yet)', disabled: true }]
			},
			{
				label: 'Help',
				items: [{ type: 'action', label: 'About Stats', action: () => os.openAbout('stats') }]
			}
		],
		statusExtra: () => null
	},

	stickies: {
		id: 'stickies',
		name: 'Stickies',
		filename: 'Stickies',
		about: {
			title: 'Stickies',
			version: 'v1.0',
			tagline: 'desktop sticky notes',
			glyph: '▤',
			glyphBg: '#f9bd2b',
			glyphFg: '#0a0a0a',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'Post-it notes that live on your desktop. Write a thought, close the window, find it right where you left it next time.'
				},
				{ h: 'COLORS', body: 'Yellow, pink, green, blue, orange. Pick one from the Color menu.' },
				{
					h: 'CREDITS',
					body: "Apple's Stickies from System 7.5 (1994). The real Post-it note, invented by accident."
				}
			]
		},
		preferences: null,
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New Note',
						shortcut: '⌘N',
						action: () => os.launchApp('stickies', { action: 'new' })
					},
					{ type: 'action', label: 'Close Note', shortcut: '⌘W', action: () => os.closeFocused() }
				]
			},
			{
				label: 'Color',
				items: [
					{
						type: 'action',
						label: '● Yellow',
						action: () => os.launchApp('stickies', { action: 'color', color: '#f9bd2b' })
					},
					{
						type: 'action',
						label: '● Pink',
						action: () => os.launchApp('stickies', { action: 'color', color: '#ee63b3' })
					},
					{
						type: 'action',
						label: '● Green',
						action: () => os.launchApp('stickies', { action: 'color', color: '#a6f000' })
					},
					{
						type: 'action',
						label: '● Blue',
						action: () => os.launchApp('stickies', { action: 'color', color: '#6bb5ff' })
					},
					{
						type: 'action',
						label: '● Orange',
						action: () => os.launchApp('stickies', { action: 'color', color: '#f54e00' })
					}
				]
			},
			{
				label: 'Help',
				items: [{ type: 'action', label: 'About Stickies', action: () => os.openAbout('stickies') }]
			}
		],
		statusExtra: () => null
	},

	recorder: {
		id: 'recorder',
		name: 'Camera',
		filename: 'Camera.app',
		about: {
			title: 'Camera',
			version: 'v1.0',
			tagline: 'record short clips from your webcam',
			glyph: 'REC',
			glyphBg: 'var(--accent)',
			glyphFg: 'var(--paper)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'A camcorder on your desktop. Open Camera, look at the lens, record up to 10 seconds. Clips are saved locally in your browser.'
				},
				{
					h: 'LIMITS',
					body: 'Max 10 seconds per clip. Max 5 clips stored. Everything lives in localStorage so keep it short.'
				}
			]
		},
		preferences: null,
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New Recording',
						shortcut: '⌘N',
						action: () => os.openWindow('recorder')
					},
					{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
				]
			},
			{
				label: 'Help',
				items: [{ type: 'action', label: 'About Camera', action: () => os.openAbout('recorder') }]
			}
		],
		statusExtra: () => null
	},

	textedit: {
		id: 'textedit',
		name: 'TextEdit',
		filename: 'TextEdit.app',
		about: {
			title: 'TextEdit',
			version: 'v1.0',
			tagline: 'opens .txt files',
			glyph: 'txt',
			glyphBg: 'var(--paper)',
			glyphFg: 'var(--ink)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'A plain text editor. Opens .txt files on the Terminal desktop. README.txt, Pricing.txt, and any new files you create.'
				},
				{
					h: 'CREDITS',
					body: 'The original Mac TextEdit. The .txt format, for outliving everything else.'
				}
			]
		},
		preferences: null,
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New',
						shortcut: '⌘N',
						action: () => {
							const doc = createDoc();
							os.openWindow(`textedit-${doc.id}`);
						}
					},
					{
						type: 'action',
						label: 'Open…',
						shortcut: '⌘O',
						action: () => {
							const docs = listDocs();
							const buttons = docs.map((d) => ({
								label: d.name,
								action: () => {
									os.openWindow(`textedit-${d.id}`);
								}
							}));
							os.alert({
								title: 'Open Document',
								body: docs.length > 0 ? 'Choose a document to open:' : 'No documents found.',
								buttons: [...buttons, { label: 'Cancel', primary: true }]
							});
						}
					},
					{ type: 'separator' },
					{ type: 'action', label: 'Save', shortcut: '⌘S' },
					{ type: 'separator' },
					{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
				]
			},
			{
				label: 'Edit',
				items: [
					{ type: 'action', label: 'Undo', shortcut: '⌘Z', disabled: true },
					{ type: 'action', label: 'Cut', shortcut: '⌘X', disabled: true },
					{ type: 'action', label: 'Copy', shortcut: '⌘C', disabled: true },
					{ type: 'action', label: 'Paste', shortcut: '⌘V', disabled: true }
				]
			},
			{
				label: 'Format',
				items: [
					{ type: 'action', label: 'Plain Text', disabled: true },
					{ type: 'action', label: 'Word Wrap', disabled: true }
				]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'Preferences…',
						shortcut: '⌘,',
						action: () => os.openSystemPreferences()
					},
					{ type: 'action', label: 'About TextEdit', action: () => os.openAbout('textedit') }
				]
			}
		],
		statusExtra: () => null
	}
};
