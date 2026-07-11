# Manifest-derived store catalog and open icon registration

The app manifest is the only app catalog. The Computer Store derives its shelves from manifests, and apps can register their own pixel icons without editing OS components.

## Context

ADR 0004 made the manifest the single add-on contract, but two leaks remained.

First, the Computer Store kept a second hand-maintained catalog in `store-data.ts`: an `APPS[]` array re-declaring every store app (title, publisher, tagline, box copy, requirements) and `CATEGORIES` with hardcoded per-category `appIds[]` lists. A new store app had to be added in two places, and drift between the manifest and the store list was silent — a released app missing from `store-data.ts` simply never appeared on a shelf.

Second, the icon set was closed. `PixelIcon.svelte` was a fixed `{#if kind === …}` chain with no fallback, and the conformance test failed any manifest whose `iconKind` wasn't in that chain — so giving a new app its own icon required editing an OS component. All six coming-soon games shared the generic `doc` glyph. The Dock and My Shelf also rendered the manifest's raw emoji `icon` string next to hand-drawn pixel sprites.

## Decision

The manifest carries an optional `store` block (`StoreListing` in `app-manifest.ts`): aisle category, publisher, tagline, box-art glyph name, optional sticker, back-of-box copy, inside-the-box bullets, requirements, and an optional `shelfOrder` for when shelf placement must differ from manifest order. The box title derives from the manifest `name`, uppercased.

`store-data.ts` becomes a pure derivation over `MANIFESTS` at module load:

- `APPS` and `APP_BY_ID` map one-to-one from manifests with a `store` block.
- `CATEGORIES[*].appIds` derive from `store.category`, sorted by `shelfOrder` then manifest order — never hand-listed.
- Only what cannot live per-app stays as data: the aisle display table (label, sign color, tagline) and the box color schemes (`CAT_COLORS`).

The icon set is open:

- The manifest carries an optional `iconSprite`: rows of palette characters (one char per pixel, `.`/space transparent, palette in `$lib/components/pixel-sprite.ts`). `PixelIcon` renders any sprite generically; a sprite wins over `iconKind`.
- `PixelIcon` draws a generic app glyph for unknown kinds, so an icon is never a render hole.
- Desktop, Finder, Dock, and My Shelf pass both kind and sprite through `getAppIconKind` / `getAppIconSprite`. The Dock and My Shelf prefer the pixel icon; the emoji `icon` string remains only a text fallback where no manifest icon data exists.

## Consequences

Adding a store app is now one manifest entry: the `defineApp({...})` block with a `store` listing, plus a zero-prop component. No second catalog edit. Giving that app its own icon is an `iconSprite` on the same entry — no OS component edit. The six coming-soon games ship distinct sprites as the worked proof.

Drift cannot be silent:

- A released non-system app must carry a `store` block or an explicit `STORE_CATALOG_OMISSIONS` entry (store-data test).
- A system app must not carry a `store` block.
- Every `store.boxIcon` must name a real store box-art glyph, read out of the component source so the test can't drift.
- Every manifest icon must resolve: a known `PixelIcon` kind, or a rectangular `iconSprite` over the shared palette (conformance test). The set stays open — a sprite needs no registration.

This supersedes ADR 0004's "Current Exceptions" note that the Computer Store keeps a curated visual catalog: the catalog is now derived, and only the aisle presentation table is curated.
