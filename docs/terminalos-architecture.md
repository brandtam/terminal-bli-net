# TerminalOS Architecture

TerminalOS is a browser-resident desktop OS. It has a real filesystem model, app install lifecycle, window manager, menu bar, dock, document routing, and app host, all running inside one SvelteKit page.

## Layer Map

```
Browser page
  Desktop.svelte
    MenuBar / Dock / Window chrome / Desktop icons
    OsApiClass
      window state, active app, launch/open routing, alerts, backup UI
    WindowHost
      manifest window resolution, AppContext, lazy component loading
    TerminalFS
      folders, files, aliases, app files, ownership, backup/restore, watchers
      LocalStorageManifestStore + IndexedDBBodyStore
```

The main architectural direction is one OS host with many manifest-described apps. The host should know how to open windows, route documents, provide context, and enforce install gates. It should not know each app's render details.

## Filesystem And Storage

`TerminalFS` is the filesystem module. It owns the Terminal HD volume, node graph, app file nodes, aliases, AppData folders, blob-body references, undo state, body garbage collection, backup/restore, and app ownership/install state.

Storage is split:

- The filesystem manifest is persisted through `LocalStorageManifestStore`.
- Blob-backed file bodies are persisted through `IndexedDBBodyStore`.
- Inline text bodies ride inside the manifest.
- Preferences and window layout are still separate browser preferences and are included in backups when supplied by the OS layer.

This split is intentional. Restore is command-atomic for normal returned failures, not browser-crash atomic. See [ADR 0001](adr/0001-restore-command-atomicity.md) and [ADR 0002](adr/0002-blob-body-lifecycle.md).

## App Manifest Contract

The app manifest is the add-on contract. Each entry in `src/lib/terminalos/apps/manifests.ts` declares:

- identity: `id`, `name`, `fileName`, `category`, `description`, `icon`, `iconKind`
- lifecycle: `isSystem`, `removable`, `desktopAliasByDefault`, optional store `status`
- windows: flat `windows[]` entries with `exact` or `prefix` matching
- document handling: optional `opens` declarations on window specs
- menu bar behavior: `menus(os)`
- about and status metadata: `aboutSpec`, optional `statusExtra(os)`

The catalog synthesis layer derives the older public shapes from manifests: app library, app registry entries, window-to-app identity, app launch window ids, prefs/about routing, and icon kinds. Adding a normal fixed-window app should be a manifest entry plus a zero-prop Svelte window component.

Guardrail tests live in:

- `src/lib/terminalos/apps/app-id.test.ts`
- `src/lib/terminalos/apps/app-catalog.test.ts`
- `src/lib/terminalos/apps/app-conformance.test.ts`
- `src/lib/terminalos/apps/zero-os-edit.test.ts`

## Window Host

Window ids are resolved by `matchWindow(id)`. The match result provides:

- owning app id
- parsed args for prefix ids
- window spec
- lazy component loader

`WindowHost.svelte` renders every app window through the same path. Window components receive no props. They read `getAppContext()` for:

- `os`: the live OS API, including the shared synth at `os.audio`
- `fs`: the live TerminalFS
- `window`: this window's id, parsed args, close/focus actions
- `storage`: per-app key-value persistence, namespaced `terminal.app.<appId>.<key>` by convention (not a sandbox)
- `lifecycle`: OS-owned `onCleanup(cb)` run on window close, plus reactive `focused`/`hidden`
- `capabilities`: still a reserved seam for future sandboxing

This makes the app host a deep module: the OS handles context and lifecycle shape once, and apps remain local. See [ADR 0006](adr/0006-app-context-services.md) for the audio, lifecycle, and storage contracts.

## Document Routing

Finder and Desktop are filesystem shells, not document-handler registries. They use `openFilesystemNode`, which launches app files, delegates folder behavior to the caller, and sends all non-app files to `os.openDocument(file)`.

`os.openDocument(file)` delegates to LaunchServices-style routing in `resolveOpenTarget(file)`:

1. explicit `file.opensWith`
2. blob `contentType`
3. coarse `fileType`
4. raw file id fallback

Handlers are declared by manifest windows with `opens`. In practice, document handlers should be prefix windows so the handler can mint a document-specific id such as `textedit:<fileId>`, `sticky:<noteId>`, or `player:<fileId>`. See [ADR 0003](adr/0003-launchservices-document-routing.md).

## App Lifecycle

System apps are always owned. Store apps appear in the Computer Store according to catalog/store data and may have `released`, `coming-soon`, or `deprecated` status.

There are two related states:

- ownership: the app is on the user's shelf (`volume.ownedApps`)
- installation: an app file exists in `/Applications`, optionally with a Desktop alias

The Computer Store manages purchase/return. My Shelf manages install/uninstall. The OS open path enforces install gates for store app windows.

`TerminalFS.installApp()` deliberately creates an app file for any catalog app and does not enforce ownership. Ownership is store policy, not filesystem policy. New launch surfaces should route through `os.openWindow()` or `os.launchApp()` so the OS install gate still runs.

## Adding A Fixed-Window App

1. Add a zero-prop Svelte window component under `src/lib/apps/<app>/`.
2. Add a `defineApp({...})` entry to `MANIFESTS`.
3. Set `status: 'released'` for store apps that can launch.
4. Add one exact `role: 'app'` window with a component loader.
5. Add menus and About content in the manifest.
6. Add the app to the Computer Store data if it is sold there.
7. Run the app conformance and catalog tests.

## Adding A Document Handler

1. Add a prefix window such as `foo:<fileId>`.
2. Put the document id in `match.arg`.
3. Add `opens: { contentTypes: [...] }` or `opens: { fileTypes: [...] }`.
4. Make the window component read the file id from `ctx.window.args`.
5. Add resolver tests for `resolveOpenTarget`.
6. Add Finder/Desktop flow coverage when the user path matters.

## Current Follow-Ups

These are known review findings, not blockers to feature work:

- Custom launch apps still leak out of the manifest model. `stickies`, `textedit`, and `chatrbot` register launch handlers in `Desktop.svelte`, and `isSpecialLaunchApp` is hardcoded. Move this closer to the manifest/add-on layer before adding many more custom-launch apps.
- Finder is currently a singleton rooted by exact window args. Desktop folder opens can focus Finder without changing the target folder. Add `os.openFolder(folderId)` or folder-addressable Finder windows before building workflows that rely on Desktop folder aliases.
- Unknown documents fall back to a raw file id, which opens a dead window surface. Keep the fallback for compatibility, but add a user-facing unknown-document dialog.
- Installed dock entries only include apps with fixed launch window ids. Decide whether special-launch apps should appear in the Dock and derive that behavior from manifests.
- Add Playwright coverage for browser persistence, store purchase/install flows, and document-handler flows.

See [the feature-readiness PRD](prd/terminalos-feature-readiness.md) for the implementation plan and issue breakdown.
