import { defineApp, type TerminalAppManifest } from './app-manifest';

/**
 * One manifest per app — the single source of truth for app identity. The
 * catalog (app-catalog.ts) synthesizes APP_LIBRARY, APPS, WINDOW_APP_MAP,
 * getWindowDef, getAppWindowId and getAppIconKind from this array. Every value
 * here is copied verbatim from the structures it replaces; the synthesized
 * output must stay byte-identical to today.
 *
 * Phase 1 keeps these in one file. A later phase can split them into per-app
 * folders alongside their components.
 */
export const MANIFESTS = [
	// ── OS core (protected, not removable) ──────────────────────────────────
	defineApp({
		id: 'finder',
		name: 'Finder',
		fileName: 'Finder',
		category: 'system',
		description: 'File manager and desktop shell',
		icon: ':)',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'hd',
		window: { id: 'finder', title: 'Terminal HD', w: 480, h: 420 },
		about: { id: 'about' },
		aboutSpec: {
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
		menus: (os) => [
			{
				label: 'File',
				items: [
					{ type: 'action', label: 'New Folder', shortcut: '⌘N', disabled: true },
					{
						type: 'action',
						label: 'New Text Document',
						shortcut: '⌘T',
						action: () => os.launchApp('textedit', { action: 'new' })
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
						action: () => os.launchApp('textedit', { open: 'Pricing.txt' })
					}
				]
			},
			{
				label: 'Special',
				items: [
					{
						type: 'action',
						label: 'Empty Trash',
						action: () =>
							os.alert({
								title: 'Empty Trash',
								body: 'Are you sure you want to permanently delete the items in the Trash?',
								buttons: [
									{ label: 'Cancel' },
									{
										label: 'Empty',
										primary: true,
										action: () => os.emptyTrash()
									}
								]
							})
					},
					{ type: 'separator' },
					{
						type: 'action',
						label: 'Backup Terminal HD…',
						action: () => os.exportBackup()
					},
					{
						type: 'action',
						label: 'Restore Terminal HD…',
						action: () => os.restoreBackup()
					},
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
						action: () => os.launchApp('textedit', { open: 'README.TXT' })
					}
				]
			}
		],
		statusExtra: () => null
	}),

	defineApp({
		id: 'system-prefs',
		name: 'System Preferences',
		fileName: 'System Preferences',
		category: 'system',
		description: 'Terminal OS settings',
		icon: '⚙',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'hd',
		window: { id: 'terminal-prefs', title: 'System Preferences', w: 380, h: 360 },
		// No APPS entry today: no menus, about content, or status. Kept minimal.
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'about-terminal',
		name: 'About This Terminal',
		fileName: 'About This Terminal',
		category: 'system',
		description: 'System information',
		icon: ':)',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'doc',
		window: { id: 'about', title: 'About This Terminal', w: 380, h: 380 },
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'software-shop',
		name: 'My Shelf',
		fileName: 'My Shelf.app',
		category: 'system',
		description: 'Your owned apps',
		icon: '💾',
		removable: false,
		desktopAliasByDefault: true,
		isSystem: true,
		iconKind: 'floppy',
		window: { id: 'software-shop', title: 'My Shelf', w: 420, h: 520 },
		about: { id: 'about-software-shop' },
		aboutSpec: {
			title: 'My Shelf',
			version: 'v1.0',
			tagline: 'your owned apps',
			glyph: '📚',
			glyphBg: 'var(--accent)',
			glyphFg: 'var(--paper)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'Your library of owned software. Apps you buy at the Computer Store appear here. Install or uninstall them to your desktop from this shelf.'
				},
				{
					h: 'HOW IT WORKS',
					body: 'Click "Install" to put an app on your desktop. Click "Uninstall" to remove it (it stays on your shelf). Visit the Computer Store to find new software.'
				}
			]
		},
		menus: (os) => [
			{
				label: 'File',
				items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'About My Shelf',
						action: () => os.openAbout('software-shop')
					}
				]
			}
		],
		statusExtra: () => null
	}),

	defineApp({
		id: 'computer-store',
		name: 'Computer Store',
		fileName: 'Computer Store.app',
		category: 'system',
		description: 'Browse and buy software',
		icon: '🏪',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'floppy',
		window: { id: 'computer-store', title: 'Computer Store', w: 740, h: 620 },
		about: { id: 'about-computer-store' },
		aboutSpec: {
			title: 'Computer Store',
			version: 'v1.0',
			tagline: 'the 8-bit shopping experience',
			glyph: '🏪',
			glyphBg: '#f5b34f',
			glyphFg: '#0a0a0a',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'A software store. Walk in, browse the aisles, pick up a box, read the back, drop it in your cart, and check out at the counter. Everything costs $0.00. The store metaphor is the whole point.'
				},
				{
					h: 'HOW IT WORKS',
					body: 'Click an aisle to step closer. Click a software box to pick it up. Add it to your cart. Head to the counter and ring up. Purchased apps appear on My Shelf, ready to install.'
				}
			]
		},
		menus: (os) => [
			{
				label: 'File',
				items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'About Computer Store',
						action: () => os.openAbout('computer-store')
					}
				]
			}
		],
		statusExtra: () => null
	}),

	defineApp({
		id: 'trash',
		name: 'Trash',
		fileName: 'Trash',
		category: 'system',
		description: 'Deleted items',
		icon: '🗑',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'doc',
		window: { id: 'trash', title: 'Trash', w: 380, h: 320 },
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	// ── System apps bundled with OS (not in the Computer Store) ─────────────
	defineApp({
		id: 'textedit',
		name: 'TextEdit',
		fileName: 'TextEdit.app',
		category: 'productivity',
		description: 'Plain text editor',
		icon: 'txt',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'doc',
		window: { idPrefix: 'textedit-', title: 'Untitled.txt', w: 420, h: 400 },
		about: { id: 'about-textedit' },
		aboutSpec: {
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
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New',
						shortcut: '⌘N',
						action: () => os.launchApp('textedit', { action: 'new' })
					},
					{
						type: 'action',
						label: 'Open…',
						shortcut: '⌘O',
						action: () => os.launchApp('textedit', { action: 'open' })
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
	}),

	defineApp({
		id: 'stickies',
		name: 'Stickies',
		fileName: 'Stickies',
		category: 'productivity',
		description: 'Desktop sticky notes',
		icon: '▤',
		removable: false,
		desktopAliasByDefault: true,
		isSystem: true,
		iconKind: 'stickies',
		window: { idPrefix: 'sticky-', title: 'Stickies', w: 240, h: 220 },
		about: { id: 'about-stickies' },
		aboutSpec: {
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
	}),

	// ── Store apps (must be bought at the Computer Store) ────────────────────
	defineApp({
		id: 'tvguide',
		name: 'TV Guide',
		fileName: 'TV Guide.app',
		category: 'entertainment',
		description: 'Channel guide and schedule',
		icon: 'TV',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released',
		iconKind: 'tvguide',
		window: { id: 'tv-guide', title: 'TV Guide.app', w: 660, h: 700 },
		about: { id: 'about-tvguide' },
		prefs: { id: 'tvguide-prefs', title: 'TV Guide Preferences', w: 360, h: 360 },
		aboutSpec: {
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
						action: () => os.launchApp('textedit', { open: 'README.TXT' })
					}
				]
			}
		],
		statusExtra: (os) => {
			const count = os.guide.liveCount();
			if (count === 0) return null;
			return { label: `${count} LIVE`, kind: 'live' };
		}
	}),

	defineApp({
		id: 'chatrbot',
		name: 'chatrbot',
		fileName: 'chatrbot.app',
		category: 'entertainment',
		description: 'Chat with TV characters',
		icon: 'cb',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'released',
		iconKind: 'doc',
		window: { idPrefix: 'chat-', title: 'Chat', w: 440, h: 560 },
		about: { id: 'about-chatrbot' },
		prefs: { id: 'chatrbot-prefs', title: 'chatrbot Preferences', w: 360, h: 280 },
		aboutSpec: {
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
	}),

	defineApp({
		id: 'recorder',
		name: 'Camera',
		fileName: 'Camera.app',
		category: 'utilities',
		description: 'Record short webcam clips',
		icon: 'REC',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released',
		iconKind: 'tv',
		// recorder has BOTH a fixed window and minted instances. The fixed
		// window's size/title is what getWindowDef returns for 'recorder';
		// the 'recorder-' prefix mints per-clip windows (sized dynamically
		// from the file node, so the prefix carries the fallback def).
		window: { id: 'recorder', idPrefix: 'recorder-', title: 'Camera.app', w: 360, h: 480 },
		about: { id: 'about-recorder' },
		aboutSpec: {
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
	}),

	defineApp({
		id: 'stats',
		name: 'Stats',
		fileName: 'Stats.app',
		category: 'utilities',
		description: 'System statistics',
		icon: '≡',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released',
		iconKind: 'calc',
		window: { id: 'stats', title: 'Stats.app', w: 360, h: 360 },
		about: { id: 'about-stats' },
		aboutSpec: {
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
	}),

	defineApp({
		id: 'error',
		name: 'DO_NOT_OPEN',
		fileName: 'DO_NOT_OPEN',
		category: 'utilities',
		description: 'Mystery app',
		icon: '⚠',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released',
		iconKind: 'floppy',
		window: { id: 'error', title: 'System Error', w: 420, h: 260 },
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'tetra',
		name: 'Tetra',
		fileName: 'Tetra.app',
		category: 'entertainment',
		description: 'Falling block puzzle',
		icon: '▦',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'solitaire',
		name: 'Solitaire',
		fileName: 'Solitaire.app',
		category: 'entertainment',
		description: 'Card game',
		icon: '♠',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'minesweep',
		name: 'Minesweep',
		fileName: 'Minesweep.app',
		category: 'entertainment',
		description: 'Grid puzzle with bombs',
		icon: '💣',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'zorquest',
		name: 'ZorQuest',
		fileName: 'ZorQuest.app',
		category: 'entertainment',
		description: 'Text adventure',
		icon: '📜',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'calc',
		name: 'Calc.app',
		fileName: 'Calc.app',
		category: 'productivity',
		description: 'Calculator',
		icon: '🧮',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'paint',
		name: 'Pixel Paint',
		fileName: 'Pixel Paint.app',
		category: 'productivity',
		description: 'Bitmap painting',
		icon: '🖌',
		removable: true,
		desktopAliasByDefault: false,
		isSystem: false,
		status: 'coming-soon',
		iconKind: 'doc',
		menus: () => [],
		aboutSpec: { title: '', version: '', tagline: '', glyph: '', glyphBg: '', sections: [] }
	}),

	defineApp({
		id: 'vcr',
		name: 'VCR',
		fileName: 'VCR.app',
		category: 'entertainment',
		description: 'Retro video player',
		icon: '📼',
		removable: true,
		desktopAliasByDefault: true,
		isSystem: false,
		status: 'released',
		iconKind: 'tv',
		// The VCR window is sized to the selected device at lookup time
		// (see app-catalog.ts). The def here is the AG-500R default; the
		// generic variant is special-cased in synthWindowDefs/getWindowDef.
		window: { id: 'vcr', title: 'VCR.app', w: 900, h: 560, minW: 620, minH: 420 },
		about: { id: 'about-vcr' },
		prefs: { id: 'vcr-prefs', title: 'VCR Preferences', w: 360, h: 300 },
		aboutSpec: {
			title: 'VCR',
			version: 'v1.0',
			tagline: 'be kind, rewind',
			glyph: '📼',
			glyphBg: '#1a1a1a',
			glyphFg: '#3f3',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'A video cassette recorder for your desktop. Loads tapes from the Internet Archive — full episodes of retro computing shows, streamed directly to your CRT.'
				},
				{
					h: 'THE LIBRARY',
					body: 'The Computer Chronicles (1983–2002), BBS: The Documentary, The Computer Programme, the 1972 ARPANET documentary, and Net Cafe. More tapes being added.'
				},
				{
					h: 'HOW IT WORKS',
					body: 'Pick a show from the tape library. Pick an episode. Hit play. The video streams from archive.org. No account needed, no ads, no fees.'
				},
				{
					h: 'CREDITS',
					body: 'The Internet Archive, for preserving everything. Stewart Cheifet, for 20 years of Computer Chronicles. Jason Scott, for the BBS Documentary. The BBC, for The Computer Programme.'
				}
			]
		},
		menus: (os) => [
			{
				label: 'File',
				items: [
					{
						type: 'action',
						label: 'New VCR Window',
						shortcut: '⌘N',
						action: () => os.openWindow('vcr')
					},
					{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
				]
			},
			{
				label: 'Help',
				items: [
					{
						type: 'action',
						label: 'Preferences…',
						shortcut: '⌘,',
						action: () => os.openPreferences('vcr')
					},
					{ type: 'separator' },
					{ type: 'action', label: 'About VCR', action: () => os.openAbout('vcr') }
				]
			}
		],
		statusExtra: () => null
	})
];
