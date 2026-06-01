import { defineApp } from './app-manifest';
// Import folder ids from the leaf module, NOT the $lib/terminalos barrel: this
// file is read by app-catalog at module load, and the barrel pulls terminal-fs →
// app-install → app-catalog, which would be a load-order cycle.
import { ROOT_ID, TRASH_ID } from '../filesystem/well-known-ids';
import { vcrPrefs } from '$lib/apps/vcr/vcr-prefs.svelte';
import { recorderState } from '$lib/apps/recorder/recorder-state.svelte';

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
		// No About box of its own: the system About (window id 'about') is owned by
		// the `system` app. Finder's Help → About Terminal routes there via
		// os.openAbout(null), and matchWindow resolves 'about' → system, so the menu
		// bar reads "Terminal" when it's focused (not "Finder").
		// Finder and Trash are the SAME component pointed at two folders, declared as
		// exact flat windows carrying a static `folder` arg (the static-arg-on-exact
		// mechanism, #35). The trash entry lives on the finder manifest so
		// matchWindow('trash') → appId 'finder' and the menu bar reads "Finder" for
		// both. No `opens`: neither is a document handler. Legacy window/component
		// stay additively until the collapse.
		windows: [
			{
				match: { kind: 'exact', id: 'finder', args: { folder: ROOT_ID } },
				role: 'app',
				title: () => 'Terminal HD',
				size: () => ({ w: 480, h: 420 }),
				component: () => import('$lib/apps/finder/FinderWindow.svelte')
			},
			{
				match: { kind: 'exact', id: 'trash', args: { folder: TRASH_ID } },
				role: 'chrome',
				title: () => 'Trash',
				size: () => ({ w: 380, h: 320 }),
				component: () => import('$lib/apps/finder/FinderWindow.svelte')
			}
		],
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

	// The system app owns the OS chrome dialogs — About This Terminal, the
	// per-app About boxes (about:<id>), System Preferences, and maintenance.
	// They render through the flat Window Host like any other window, and the menu
	// bar reads this app's name ("Terminal") whenever one of them is focused. It
	// folds away the old `system-prefs` + `about-terminal` pseudo-manifests. None
	// of its windows declare `opens`, so the system app is not a document handler.
	defineApp({
		id: 'system',
		name: 'Terminal',
		fileName: 'Terminal',
		category: 'system',
		description: 'System chrome — About, System Preferences, Maintenance',
		icon: ':)',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'hd',
		windows: [
			{
				match: { kind: 'exact', id: 'about' },
				role: 'about',
				title: () => 'About This Terminal',
				size: () => ({ w: 380, h: 380 }),
				component: () => import('$lib/apps/finder/AboutTerminal.svelte')
			},
			{
				// Per-app About box. The id names which app (about:vcr → vcr); the
				// shared AboutAppWindow reads args.appId and renders that app's spec.
				// The title resolves the app's display name from the static manifest
				// registry — SpecCtx has no `os`, so it must look the name up purely
				// over MANIFESTS (see manifestName below). Listed AFTER the exact
				// 'about' entry so the bare 'about' id never falls into this prefix.
				match: { kind: 'prefix', prefix: 'about:', arg: 'appId' },
				role: 'about',
				title: ({ args }) => `About ${manifestName(args.appId)}`,
				size: () => ({ w: 420, h: 460 }),
				component: () => import('$lib/apps/finder/AboutAppWindow.svelte')
			},
			{
				match: { kind: 'exact', id: 'terminal-prefs' },
				role: 'prefs',
				title: () => 'System Preferences',
				size: () => ({ w: 380, h: 360 }),
				component: () => import('$lib/components/TerminalPrefs.svelte')
			},
			{
				match: { kind: 'exact', id: 'system-maintenance' },
				role: 'chrome',
				title: () => 'System Maintenance',
				size: () => ({ w: 520, h: 460, minW: 460, minH: 390 }),
				component: () => import('$lib/components/SystemMaintenance.svelte')
			}
		],
		// A non-empty aboutSpec.title is what puts an app in APPS (the hasRegistryEntry
		// gate), and the menu bar reads APPS[activeAppId] for the name + menus. The
		// system app never shows its own About box, so the rest stays empty.
		aboutSpec: {
			title: 'Terminal',
			version: '',
			tagline: '',
			glyph: '',
			glyphBg: '',
			sections: []
		},
		menus: (os) => [
			{
				label: 'File',
				items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
			},
			{
				label: 'Help',
				items: [
					{ type: 'action', label: 'About Terminal', action: () => os.openAbout(null) },
					{ type: 'action', label: 'Welcome', action: () => os.launchApp('welcome') }
				]
			}
		],
		statusExtra: () => null
	}),

	defineApp({
		id: 'welcome',
		name: 'Welcome',
		fileName: 'Welcome.app',
		category: 'system',
		description: 'Guided tour and reference app',
		icon: '★',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'doc',
		windows: [
			{
				match: { kind: 'exact', id: 'welcome' },
				role: 'app',
				title: () => 'Welcome.app',
				size: () => ({ w: 460, h: 540 }),
				component: () => import('$lib/apps/welcome/WelcomeWindow.svelte')
			}
		],
		aboutSpec: {
			title: 'Welcome',
			version: 'v1.0',
			tagline: 'the AppContext reference app',
			glyph: '★',
			glyphBg: 'var(--accent)',
			glyphFg: 'var(--paper)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'The first app Terminal opens. It is also the small worked example for the app host: one manifest window, one AppContext, no bespoke props.'
				},
				{
					h: 'HOW IT WORKS',
					body: 'Its buttons drive the real OS through ctx.os, so the tour is the same path any app author can use.'
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
				items: [{ type: 'action', label: 'About Welcome', action: () => os.openAbout('welcome') }]
			}
		],
		statusExtra: () => null
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
		// One fixed window; SoftwareShopWindow reads os/fs off getAppContext(), no props.
		windows: [
			{
				match: { kind: 'exact', id: 'software-shop' },
				role: 'app',
				title: () => 'My Shelf',
				size: () => ({ w: 420, h: 520 }),
				component: () => import('$lib/apps/software-shop/SoftwareShopWindow.svelte')
			}
		],
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
		// ComputerStoreWindow reads os/fs off getAppContext(), no props.
		windows: [
			{
				match: { kind: 'exact', id: 'computer-store' },
				role: 'app',
				title: () => 'Computer Store',
				size: () => ({ w: 740, h: 620 }),
				component: () => import('$lib/apps/computer-store/ComputerStoreWindow.svelte')
			}
		],
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
		// Trash's window lives on the finder manifest (matchWindow('trash') → finder,
		// the shared FinderWindow scoped to the Trash folder), so this app declares
		// no window of its own — it carries only the Trash library/desktop identity.
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
		// One window minted per open document, keyed `textedit:<fileId>`. The `:`
		// separator matches chat:/player:/about: (file-ids contain `-`; the tail is
		// sliced by prefix length, unambiguous either way). The title is the file's
		// name, read purely from the fs node since SpecCtx is {args, fs}.
		windows: [
			{
				match: { kind: 'prefix', prefix: 'textedit:', arg: 'fileId' },
				role: 'app',
				title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'Untitled.txt',
				size: () => ({ w: 420, h: 400 }),
				component: () => import('$lib/apps/textedit/TextEditWindow.svelte'),
				opens: { fileTypes: ['text'] }
			}
		],
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
		// Each note is a flat prefix window `sticky:<noteId>`. chromeless: true is
		// spec-driven (Desktop reads it off the resolved spec) — stickies draw their
		// own chrome, so the title is cosmetic.
		windows: [
			{
				match: { kind: 'prefix', prefix: 'sticky:', arg: 'noteId' },
				role: 'app',
				chromeless: true,
				title: () => 'Stickies',
				size: () => ({ w: 240, h: 220 }),
				component: () => import('$lib/apps/stickies/StickiesNote.svelte'),
				opens: { fileTypes: ['sticky'] }
			}
		],
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
		// A fixed main window + a prefs dialog. TVGuide / TVGuidePrefs read
		// everything (channels, clock, tweaks) off getAppContext(), so neither takes props.
		windows: [
			{
				match: { kind: 'exact', id: 'tv-guide' },
				role: 'app',
				title: () => 'TV Guide.app',
				size: () => ({ w: 660, h: 700 }),
				component: () => import('$lib/components/TVGuide.svelte')
			},
			{
				match: { kind: 'exact', id: 'tvguide-prefs' },
				role: 'prefs',
				title: () => 'TV Guide Preferences',
				size: () => ({ w: 360, h: 360 }),
				component: () => import('$lib/components/TVGuidePrefs.svelte')
			}
		],
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
		// One minted instance per show, keyed `chat:<slug>`, plus a prefs dialog. The
		// `:` separator (not `-`) keeps the arg unambiguous since show slugs contain
		// `-` (e.g. `breaking-bad`). The title is derived from the slug alone —
		// SpecCtx is just {args, fs}, so the live group name is read inside ChatWindow.
		windows: [
			{
				match: { kind: 'prefix', prefix: 'chat:', arg: 'slug' },
				role: 'app',
				title: ({ args }) =>
					(args.slug ?? '')
						.split('-')
						.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
						.join(' ') || 'Chat',
				size: () => ({ w: 440, h: 560 }),
				component: () => import('$lib/components/ChatWindow.svelte')
			},
			{
				match: { kind: 'exact', id: 'chatrbot-prefs' },
				role: 'prefs',
				title: () => 'chatrbot Preferences',
				size: () => ({ w: 360, h: 280 }),
				component: () => import('$lib/components/ChatrbotPrefs.svelte')
			}
		],
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
		// Camera is exact-only: one fixed `recorder` window. There is NO
		// `recorder-`/`recorder:` prefix — recorded clips are tagged
		// opensWith:'player' and open in the system Player (the bug_002 fix) — and
		// no `opens` here (the Camera UI isn't a doc handler).
		windows: [
			{
				match: { kind: 'exact', id: 'recorder' },
				role: 'app',
				title: () => 'Camera.app',
				size: () => ({ w: 360, h: 480 }),
				component: () => import('$lib/apps/recorder/RecorderWindow.svelte')
			}
		],
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
		// The "● REC" menu-bar badge rides the active-app status channel: it shows
		// only while Camera is focused and recording. recorderState flips on
		// start/stop, and MenuBar's $derived(app.statusExtra?.(os)) re-runs on the flip.
		statusExtra: () => (recorderState.recording ? { label: 'REC', kind: 'rec' } : null)
	}),

	defineApp({
		id: 'player',
		name: 'Player',
		fileName: 'Player.app',
		category: 'system',
		description: 'Plays video files',
		icon: '▶',
		removable: false,
		desktopAliasByDefault: false,
		isSystem: true,
		iconKind: 'tv',
		// Flat window model: the Player has no fixed window, only minted
		// player:<fileId> instances. It is a GENERAL video document handler —
		// declaring the content-types it opens is what routes any video file here
		// via os.openDocument, with no per-app switch. A clip made by the
		// (removable) Camera app opens here even after Camera is uninstalled,
		// because the Player is a system app that is always present.
		windows: [
			{
				// The Player's own launch window. Opening Player.app from Applications
				// (no document) lands here and shows an empty state. It resolves
				// through the flat matcher — exact id 'player' — so the Player needs
				// no fixed `window` field; getAppWindowId('player') still returns
				// 'player'. Distinct from the minted player:<fileId> instances below.
				match: { kind: 'exact', id: 'player' },
				role: 'app',
				title: () => 'Player',
				size: () => ({ w: 480, h: 380, minW: 320, minH: 240 }),
				component: () => import('$lib/apps/player/MediaPlayerWindow.svelte')
			},
			{
				match: { kind: 'prefix', prefix: 'player:', arg: 'fileId' },
				role: 'app',
				title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'Player',
				size: () => ({ w: 480, h: 380, minW: 320, minH: 240 }),
				component: () => import('$lib/apps/player/MediaPlayerWindow.svelte'),
				opens: { contentTypes: ['video/webm', 'video/mp4'], fileTypes: ['recording'] }
			}
		],
		aboutSpec: {
			title: 'Player',
			version: 'v1.0',
			tagline: 'play video clips',
			glyph: '▶',
			glyphBg: 'var(--accent)',
			glyphFg: 'var(--paper)',
			sections: [
				{
					h: 'WHAT IT IS',
					body: 'The system video player. Opens any video file — clips recorded with Camera, or other video saved to disk — and plays it in its own window.'
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
				items: [{ type: 'action', label: 'About Player', action: () => os.openAbout('player') }]
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
		// One fixed window; StatsWindow reads its counts off getAppContext(), no props.
		windows: [
			{
				match: { kind: 'exact', id: 'stats' },
				role: 'app',
				title: () => 'Stats.app',
				size: () => ({ w: 360, h: 360 }),
				component: () => import('$lib/apps/stats/StatsWindow.svelte')
			}
		],
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
		// ErrorDialog reads its close action off getAppContext().window, no props. role:'app'
		// because this is a launchable window (error has a desktop alias, so
		// getAppWindowId('error') must resolve to it). Its menu-bar identity reads as
		// Finder via the one remaining WINDOW_APP_OVERRIDES entry (checked before
		// matchWindow), even though this manifest's appId is 'error'.
		windows: [
			{
				match: { kind: 'exact', id: 'error' },
				role: 'app',
				title: () => 'System Error',
				size: () => ({ w: 420, h: 260 }),
				component: () => import('$lib/apps/finder/ErrorDialog.svelte')
			}
		],
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
		// The main VCR window + its prefs dialog. The main window's
		// title/size/component are device-aware: SpecCtx bans the reactive `os` but
		// NOT module stores, so these read `vcrPrefs.device` directly (generic carries
		// minW 480 / minH 470). The two decks are separate imports so only the
		// selected one enters the bundle (#28). A device switch while a vcr window is
		// open calls invalidateWindow('vcr') (see vcr-prefs.svelte) so the next
		// resolve picks the new deck + size.
		windows: [
			{
				match: { kind: 'exact', id: 'vcr' },
				role: 'app',
				title: () => 'VCR.app',
				size: () =>
					vcrPrefs.device === 'generic'
						? { w: 560, h: 523, minW: 480, minH: 470 }
						: { w: 900, h: 560, minW: 620, minH: 420 },
				component: () =>
					vcrPrefs.device === 'ag500r'
						? import('$lib/apps/vcr/VCRWindowAG500R.svelte')
						: import('$lib/apps/vcr/VCRWindow.svelte')
			},
			{
				match: { kind: 'exact', id: 'vcr-prefs' },
				role: 'prefs',
				title: () => 'VCR Preferences',
				size: () => ({ w: 360, h: 300 }),
				component: () => import('$lib/components/VCRPrefs.svelte')
			}
		],
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

/**
 * App display name from the static manifest registry. The system app's per-app
 * About title (`about:<id>`) needs it, and that title runs inside getWindowDef
 * with no `os` (SpecCtx is { args, fs }) — so it resolves the name purely over
 * MANIFESTS, which is a fully-initialized module constant by the time any window
 * opens. Declared after MANIFESTS; the title closure above is only invoked at
 * window-open time, long after this module finishes loading.
 */
function manifestName(appId: string): string {
	return MANIFESTS.find((m) => m.id === appId)?.name ?? '';
}
