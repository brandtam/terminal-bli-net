# Hello World

The smallest app that's still a real app. One window with three buttons: one bumps a local counter, one pops a system alert through the OS, one opens the app's own About box. It's here to show the whole shape of an app with nothing else in the way.

Two pieces make it work — a zero-prop Svelte component and a manifest entry. That's every app, not just this one.

## Clone it in three steps

### 1. Copy the component into the app tree

```bash
mkdir -p src/lib/apps/hello-world
cp examples/hello-world/HelloWorldWindow.svelte src/lib/apps/hello-world/
```

Apps live under `src/lib/apps/<your-app>/`. The component imports nothing from this `examples/` folder, so it works as soon as it lands there.

### 2. Register it in the manifest

Open `src/lib/terminalos/apps/manifests.ts` and add this entry to the `MANIFESTS` array (next to the other `defineApp(...)` blocks):

```ts
defineApp({
	id: 'hello-world',
	name: 'Hello World',
	fileName: 'Hello World.app',
	category: 'utilities',
	description: 'A starter app to copy',
	icon: '👋',
	removable: true,
	desktopAliasByDefault: true,
	isSystem: true,
	iconKind: 'doc',
	windows: [
		{
			match: { kind: 'exact', id: 'hello-world' },
			role: 'app',
			title: () => 'Hello World',
			size: () => ({ w: 380, h: 320 }),
			component: () => import('$lib/apps/hello-world/HelloWorldWindow.svelte')
		}
	],
	aboutSpec: {
		title: 'Hello World',
		version: 'v1.0',
		tagline: 'the app you copied to make your own',
		glyph: '👋',
		glyphBg: 'var(--paper-soft)',
		glyphFg: 'var(--ink)',
		sections: [{ h: 'WHAT IT IS', body: 'A starter app. Change everything.' }]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
		},
		{
			label: 'Help',
			items: [
				{ type: 'action', label: 'About Hello World', action: () => os.openAbout('hello-world') }
			]
		}
	],
	statusExtra: () => null
});
```

### 3. Run it

```bash
pnpm dev          # http://localhost:5173
```

Because this is a system app (`isSystem: true`), it's seeded straight into `/Applications` and — thanks to `desktopAliasByDefault: true` — onto your Desktop. Double-click **Hello World** and it opens. No store, no purchase, no API key.

Want it sold in the Computer Store instead? That's a different path: set `isSystem: false` and `status: 'released'`, then add an entry to `src/lib/apps/computer-store/store-data.ts` (the `APPS` array plus a `CATEGORIES` listing). The manifest alone doesn't put anything in the store. See [docs/writing-an-app.md](../../docs/writing-an-app.md#making-your-app-launchable).

## What each manifest field means

| Field                   | What it does                                                                                                                                                                     | Change it?                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `id`                    | Unique app id, referenced everywhere (`os.openAbout('hello-world')`). Keep it a plain string literal.                                                                            | Yes — make it your app's id.  |
| `name` / `fileName`     | Display name and the `.app` file in `/Applications`.                                                                                                                             | Yes.                          |
| `category`              | Groups the app in the store/library (`'utilities'`, etc.).                                                                                                                       | Maybe.                        |
| `description`           | One-liner in store and library lists.                                                                                                                                            | Yes.                          |
| `icon`                  | Emoji/short string for list views.                                                                                                                                               | Yes.                          |
| `iconKind`              | Which shared pixel sprite to draw. Must be a real one: `hd`, `folder`, `tv`, `doc`, `trash`, `calc`, `floppy`, `stickies`, `guide`. The conformance test rejects anything else.  | Pick from the list.           |
| `removable`             | Can the user trash it?                                                                                                                                                           | Usually `true`.               |
| `desktopAliasByDefault` | Drop a Desktop alias on install.                                                                                                                                                 | Your call.                    |
| `isSystem`              | `true` = bundled with the OS, always owned, auto-seeded to /Applications + Desktop. We use it here so the app appears with no store wiring. `false` = a store app you must sell. | Keep `true` while developing. |
| `status`                | Store lifecycle (`'released'`, `'coming-soon'`, `'deprecated'`). Only for store apps; omit it for a system app.                                                                  | Omitted here.                 |
| `windows`               | The windows the app owns. Hello World has one fixed window.                                                                                                                      | See below.                    |
| `menus(os)`             | The menu-bar menus when your app is frontmost.                                                                                                                                   | Add your own items.           |
| `aboutSpec`             | About-dialog content. `os.openAbout('hello-world')` shows it — no separate window needed.                                                                                        | Yes.                          |
| `statusExtra(os)`       | Optional menu-bar status item; return `null` for none.                                                                                                                           | Leave `null`.                 |

Inside `windows[]`, the one entry says: match the exact id `hello-world` (`role: 'app'` marks it as the launch window), give it a fixed title and size, and lazy-load the component. Swap the `id`, `title`, `size`, and `component` path for your app. To open files instead of a fixed window, you want a **prefix window** with an `opens` declaration — that's covered in [docs/writing-an-app.md](../../docs/writing-an-app.md#opening-documents-the-file--window-path).

## Confirm it's wired correctly

```bash
pnpm test:unit    # app-conformance + zero-os-edit guardrails
pnpm check        # types
```

`app-conformance.test.ts` checks your window routes back to its app, loads, has a unique id, and uses a valid icon kind. `zero-os-edit.test.ts` proves the OS launched your app without any OS-code change — which, if you only touched these two files, it did.

## Next

Read [docs/writing-an-app.md](../../docs/writing-an-app.md) for the `AppContext` your component receives (`os`, `fs`, `window`), the full `WindowSpec` reference, and how to open documents.
