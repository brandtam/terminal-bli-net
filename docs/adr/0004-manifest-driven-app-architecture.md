# Manifest-driven app architecture

TerminalOS apps are registered through app manifests, not through OS render branches.

## Context

The OS used to accumulate app knowledge in several places: app library metadata, app registry data, window/app maps, launch ids, icon selection, menu behavior, About content, and render branches. That made adding apps easy to get half-right and hard to review.

The current direction is feature growth through add-on apps and games. That requires a small authoring interface with high leverage: one app declaration should drive installation metadata, launch routing, window hosting, menus, About content, and document-open routing.

## Decision

Each app declares a `TerminalAppManifest` in `src/lib/terminalos/apps/manifests.ts`.

The manifest owns:

- app identity and lifecycle metadata
- icon metadata
- flat `windows[]` declarations
- menu specs
- About specs
- optional status badges
- optional document handler declarations through `opens`

The catalog layer derives compatibility structures from the manifest list:

- `APP_LIBRARY`
- `APPS`
- window-to-app identity
- app-to-launch-window ids
- app-to-icon-kind mapping
- About and Preferences window ids

Windows use a flat model:

- `exact` windows claim one stable id, such as `vcr` or `terminal-prefs`.
- `prefix` windows mint instances, such as `textedit:<fileId>`, `sticky:<noteId>`, `player:<fileId>`, or `chat:<slug>`.
- Prefix matches expose the tail as named args through `ctx.window.args`.
- Exact matches may also provide static args, as Finder and Trash do for their folder ids.

All app windows render through `WindowHost.svelte`. Window components receive no bespoke props. They read `getAppContext()` for the OS API, filesystem, current window handle, and future storage/capability/lifecycle handles.

Document handlers are declared on manifest windows with `opens`. For now, document handlers should be prefix windows so LaunchServices can mint a document-specific target id from the file id.

## Consequences

Adding a normal fixed-window app should not require editing OS render code. The expected authoring path is:

1. create a zero-prop Svelte component
2. add a manifest entry
3. add store data if sold in the Computer Store
4. run manifest conformance tests

The manifest is now the deep module for app identity. This improves locality: app metadata changes stay near the app declaration, and the OS host remains generic.

The compiler and tests guard the main contract:

- `AppId` is a closed union derived from manifests.
- persisted app ids stay open strings at disk boundaries.
- every manifest window resolves through `matchWindow`.
- every manifest window lazy-loads a real component.
- document-handler type collisions fail loudly.
- a synthetic manifest-only app resolves, routes, launches, and renders without OS edits.

## Current Exceptions

Custom launch behavior is not fully manifest-driven yet. `stickies`, `textedit`, and `chatrbot` register handlers from `Desktop.svelte`, and the special-launch app list is hardcoded. This is acceptable as a transition point, but it is the largest remaining leak in the add-on architecture.

The next deepening should move custom launch declarations and handlers closer to the manifest/add-on layer, then derive special-launch detection, Dock launch entries, and launch routing from that same source.

The Computer Store also keeps a curated visual catalog. That can stay separate for presentation, but tests should ensure every sellable catalog app is represented or intentionally omitted.
