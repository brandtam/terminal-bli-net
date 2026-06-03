# Writing an app for Terminal

Terminal is a desktop OS that runs in a browser tab. An app is a window (or a few) plus the code that fills it. The OS already knows how to open windows, route documents, draw the menu bar, and hand your app a live connection to the system. You write the part that's yours.

The whole contract is two things:

1. **One manifest entry** — a `defineApp({...})` block that tells the OS your app exists, what it's called, and which windows it owns.
2. **One zero-prop Svelte component** per window — it reads the system through `getAppContext()` and renders.

That's it. You never edit OS code to add an app. A guardrail test (`zero-os-edit.test.ts`) registers a fresh app at runtime and proves the OS routes, launches, and renders it with no OS change — so if you ever feel the urge to add a `startsWith('myapp-')` somewhere in the OS, stop. You don't need to.

## The smallest real app: Stats

Stats is the app to copy. It's one window, 48 lines, no document handling, no custom launch. Read these two pieces and you've seen the entire surface.

### The component

`src/lib/apps/stats/StatsWindow.svelte`:

```svelte
<script lang="ts">
	import { getAppContext } from '$lib/os/os-context';

	// Window components take no props — they read the shared context and derive
	// what they need. The counts come straight off the live OS state (reactive).
	const { os } = getAppContext();
	const showCount = $derived(os.groups.filter((g) => g.active).length);
	const botCount = $derived(os.bots.length);
</script>

<div class="stats">
	<div class="row"><span>Shows online</span><span class="n">{showCount}</span></div>
	<div class="row"><span>Characters</span><span class="n">{botCount}</span></div>
	<!-- …more rows… -->
</div>
```

No `$props()`. The component pulls `os` out of `getAppContext()` and reads its reactive fields — when OS state changes, the `$derived` values update on their own.

### The manifest entry

In `src/lib/terminalos/apps/manifests.ts`, inside the `MANIFESTS` array:

```ts
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
		sections: [{ h: 'WHAT IT IS', body: 'A very simple stats app.' }]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
		},
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About Stats', action: () => os.openAbout('stats') }]
		}
	],
	statusExtra: () => null
});
```

To make your own app: copy this block, change `id` and the strings, point `component` at your new `.svelte` file, and you're running.

## The manifest fields

| Field                   | What it's for                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | Unique app id. The closed `AppId` union is _derived_ from these, so keep it a plain string literal — `defineApp` infers it.                             |
| `name` / `fileName`     | Display name and the `.app` file name in `/Applications`.                                                                                               |
| `category`              | Groups the app in the store / library.                                                                                                                  |
| `description`           | One-liner for store and library lists.                                                                                                                  |
| `icon`                  | Emoji or short string for lists.                                                                                                                        |
| `iconKind`              | Which shared pixel sprite to draw (e.g. `'doc'`, `'tv'`, `'floppy'`, `'calc'`). Must match a real `PixelIcon` glyph — the conformance test checks this. |
| `removable`             | Can the user trash it? System apps are `false`.                                                                                                         |
| `desktopAliasByDefault` | Drop an alias on the Desktop on install.                                                                                                                |
| `isSystem`              | System apps are always owned and never sold in the store.                                                                                               |
| `status`                | Store-app lifecycle: `'released'`, `'coming-soon'`, `'deprecated'`. Omit for system apps. Set `'released'` so a store app can actually launch.          |
| `windows`               | The flat list of windows the app owns (see below).                                                                                                      |
| `menus(os)`             | Builds the menu-bar menus when your app is frontmost.                                                                                                   |
| `aboutSpec`             | Content for the About dialog. `os.openAbout('yourId')` mints it for free — no separate About window.                                                    |
| `statusExtra(os)`       | Optional menu-bar status item (e.g. the Camera REC badge). Return `null` if you have none.                                                              |
| `launch`                | Optional custom launch handler. Apps with a fixed `role:'app'` window launch through it automatically; you only need this for prefix-only apps.         |

## The window spec

Each entry in `windows[]` describes one window. The full type is in `src/lib/terminalos/apps/app-manifest.ts`.

- **`match`** — how a window id maps to this spec.
  - `{ kind: 'exact', id: 'stats' }` — one fixed window. Can carry static `args` (Finder and Trash are the same component pointed at different folders via `{ folder: ROOT_ID }` vs `{ folder: TRASH_ID }`).
  - `{ kind: 'prefix', prefix: 'player:', arg: 'fileId' }` — one window minted per document. Matches `player:42` _and_ parses the tail into `args.fileId === '42'`. The separator is always `:`.
- **`role`** — routing tag only, never a render branch: `'app'` (the launch window), `'prefs'` (the ⌘, dialog), `'about'`, `'chrome'`.
- **`title(ctx)` / `size(ctx)`** — pure functions of `{ args, fs }`. **No `os`** — these run before the window (and its reactive context) exists. Reading a plain module store is fine.
- **`component`** — `() => import('…')`, lazy so the chunk only loads when the window opens.
- **`chromeless?`** — the window draws its own frame (like Stickies).
- **`opens?`** — declare this **only** if the window is a document handler (see below). A launch or chrome window must not declare `opens` or it silently steals routing. Two windows claiming the same type throws at load.

## Making your app launchable

A manifest entry makes the app _exist_. Two flavors decide how a user gets to it, and they have different wiring.

**System app** (`isSystem: true`) — bundled with the OS, always owned, never sold. On a fresh disk it's seeded straight into `/Applications`, and with `desktopAliasByDefault: true` it also drops an alias on the Desktop. Run `pnpm dev` and it's just _there_ — double-click to open. This is the fastest way to see a new app, and it's how Finder, Stickies, and TextEdit ship. Omit `status` (it's for store apps only).

**Store app** (`isSystem: false`, `status: 'released'`) — sold in the Computer Store. This needs a **second edit**: the store list does not derive from the manifest. Add the app to `src/lib/apps/computer-store/store-data.ts` — both the `APPS` array (its box art, tagline, publisher) and a `CATEGORIES` entry. Only then does it show up to buy. The flow is then Computer Store → buy → My Shelf → Install, which creates the `/Applications` file.

The OS enforces this: `os.launchApp(id)` blocks a non-system app that isn't installed (`os-api.svelte.ts:429`) and shows a "buy it / install it" alert. System apps skip the gate because they're always installed. So a brand-new `isSystem: false` app with no `store-data.ts` entry is unreachable — it's in the manifest, but nothing surfaces it. When you're developing and just want to see your window, start with `isSystem: true`; flip to a store app when you're ready to wire up the storefront.

## What your component gets: AppContext

Every window reads one Svelte context, typed as `AppContext` in `src/lib/os/os-context.ts`:

```ts
const { os, fs, window } = getAppContext();
```

- **`os`** — the live OS API. Launch apps (`os.launchApp('computer-store')`), open documents, show alerts, read reactive state. Reading its `$state` fields here keeps your `$derived` values live.
- **`fs`** — the live filesystem: folders, files, app data, blob bodies.
- **`window`** — _this_ window's handle: `window.id`, `window.args` (the parsed match args), `window.close()`, `window.focus()`. Your component never builds a raw window id.
- **`storage`** — reserved handle for scoped per-app storage (not active yet; exposes no methods today).

`capabilities` and `lifecycle` are typed documentation seams for future sandboxing and a games loop. They aren't enforced — don't treat them as a security guarantee.

## Opening documents (the file → window path)

If your app opens files (a text editor, a media player), make it a **prefix window** and declare what it handles:

```ts
windows: [
	{
		match: { kind: 'prefix', prefix: 'textedit:', arg: 'fileId' },
		role: 'app',
		title: (c) => c.fs.getFile(c.args.fileId)?.name ?? 'Untitled',
		size: () => ({ w: 520, h: 420 }),
		component: () => import('$lib/apps/textedit/TextEditWindow.svelte'),
		opens: { fileTypes: ['text'] } // or { contentTypes: ['text/plain'] }
	}
];
```

When the user opens a file, `os.openDocument(file)` routes it LaunchServices-style: explicit `file.opensWith` → blob `contentType` → coarse `fileType` → raw id fallback. Your `opens` declaration is what claims the type. Inside the component, read `window.args.fileId` to know which file to load. See [ADR 0003](adr/0003-launchservices-document-routing.md) for the routing rules.

## Test it

```bash
pnpm test:unit
```

Two tests guard the app contract:

- **`app-conformance.test.ts`** — every window routes back to its app, loads a real component, has a unique id, and uses a valid icon kind.
- **`zero-os-edit.test.ts`** — proves the OS resolves and launches a brand-new app with no OS-code edit. If you broke the manifest model, this fails.

Run them before you push, and `pnpm check` for types.

## Run the whole thing locally

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

No API keys are needed to boot the OS, install apps, or build windows — keys only turn on the chat features. Your app development loop is just `pnpm dev` and a browser.

## Where to look next

- [examples/hello-world](../examples/hello-world/) — a complete starter app you can copy in and run in minutes.
- [TerminalOS architecture](terminalos-architecture.md) — the layer map, storage model, and document routing in full.
- [ADR 0004](adr/0004-manifest-driven-app-architecture.md) — why the manifest model exists and what it replaced.
- `src/lib/terminalos/apps/manifests.ts` — every existing app as a worked example. Stats and Player are the cleanest to learn from.
- `src/lib/terminalos/apps/app-manifest.ts` — the authoritative `WindowSpec` / `TerminalAppManifest` types, with comments.
