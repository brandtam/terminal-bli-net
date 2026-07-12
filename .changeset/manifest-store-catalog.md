---
type: minor
category: App Author Notes
---

Derive the Computer Store catalog from app manifests and open the icon set

- App manifests carry an optional `store` block (aisle, publisher, tagline, box art, box copy); the store's `APPS`, `CATEGORIES`, and aisle membership derive from it. Adding a store app is one manifest entry — no second edit into `store-data.ts`.
- Apps can ship their own pixel icon via `iconSprite` (rows of palette chars) — no `PixelIcon` glyph edit needed. Unknown icon kinds now draw a generic fallback instead of rendering blank, and the six coming-soon games got distinct sprites.
- The Dock and My Shelf draw pixel icons instead of raw emoji strings; the emoji stays as a text fallback.
- Drift tests: a released non-system app must declare a `store` block or an explicit omission, and every icon must resolve to a known kind or a valid sprite. See ADR 0007.
