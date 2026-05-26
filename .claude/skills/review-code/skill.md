---
description: "Review code changes against this repo's architecture, design system, and conventions"
---

# Code Review

Review the current diff (or a specified set of files) against Terminal's codebase conventions. Report findings as a checklist: pass, fail, or warn. Fix any failures before committing.

This review covers three layers: **architecture**, **design system**, and **code quality**.

---

## 1. Architecture

### Filesystem API

- [ ] New app storage uses the virtual filesystem (`$lib/os/filesystem`), not raw `localStorage` or `appRead`/`appWrite`
- [ ] Files are created in the correct folder (`DOCS_ID`, `RECORDINGS_ID`, etc.)
- [ ] File names are validated for uniqueness within their parent folder
- [ ] The `appId` on created files matches the owning app so Finder can open them

### App registry

- [ ] New apps have an entry in `src/lib/os/app-registry.ts` with `id`, `name`, `filename`, `about`, `menus`
- [ ] Window IDs for the app are registered in `WINDOW_APP_MAP` in `src/lib/os/os-api.ts`
- [ ] Window IDs are added to `KNOWN_WINDOW_IDS` in Desktop.svelte or handled by a prefix check in `isKnownWindowId`
- [ ] `getWindowDef` returns a title and size for the new window ID pattern

### Data flow

- [ ] Server-only code stays in `src/lib/server/` or `src/routes/api/`
- [ ] Client components don't import from `$lib/server/`
- [ ] Show/channel/episode data flows through the API (`/api/data`), not direct file imports on the client
- [ ] Chat messages go through `/api/chat` with `buildSystemPrompt` for episode context injection

### Schedule engine

- [ ] "Is this show on air?" checks use `isShowOnAir(slug, channels, now, timezone)` — not the removed `isOnAir(group)`
- [ ] Slot lookups use `getSlotIndex` and `getCurrentSlot` from `$lib/schedule`
- [ ] No references to removed types/functions: `DayOfWeek`, `Slot`, `isSlotActive`, `nextOnAir`, `currentlyAiring`, `validateOverlapInvariant`, `minutesRemaining`

---

## 2. Design system

### Themes — always use CSS custom properties, never hardcode values

- [ ] Colors use `var(--ink)`, `var(--paper)`, `var(--accent)`, `var(--accent-2)`, `var(--paper-soft)`, `var(--bg)`, `var(--shadow)` — not hex literals for structural colors
- [ ] Chrome elements use `var(--chrome-*)` theme variables: `--chrome-menubar-bg`, `--chrome-menubar-fg`, `--chrome-menubar-hover-bg`, `--chrome-menubar-hover-fg`, `--chrome-window-border-color`, `--chrome-window-bg`, `--chrome-titlebar-bg`
- [ ] Fonts use `var(--brand-font-ui)`, `var(--brand-font-display)`, `var(--brand-font-body)` with fallbacks — or the direct font names with correct usage:
  - `'Press Start 2P'` — labels, headings, UI chrome (small sizes: 8-11px)
  - `'VT323'` — body text, chat, descriptions (larger sizes: 16-22px)
  - `'Pixelify Sans'` — menu bar, buttons, UI elements (14-16px)

### Visual language

- [ ] Borders are `2px solid` — no 1px, no rounded corners, no blur/glow
- [ ] Box shadows are `Npx Npx 0` — no spread, no blur
- [ ] No gradients (except the titlebar stripe pattern which is a repeating-linear-gradient)
- [ ] No emoji in UI text — the pixel aesthetic replaces them
- [ ] Hover states invert: `background: var(--ink); color: var(--paper)` (or chrome equivalents)

### Components

- [ ] Dropdowns use the `Dropdown` component (`$lib/components/Dropdown.svelte`), not native `<select>`
- [ ] Windows use the `Window` component — don't build custom window chrome
- [ ] Icons use `PixelIcon` component — check available `kind` values before adding new ones
- [ ] Desktop icons use `DesktopIcon` component

### Copy and voice

- [ ] No marketing language ("revolutionary," "game-changing," "powered by AI")
- [ ] No emoji in user-facing text
- [ ] Deadpan, wry tone — see `local-docs/DIRECTION.md` for voice guidelines
- [ ] Error messages are in-character or dry, not raw technical errors shown to users

---

## 3. Code quality

### TypeScript

- [ ] `npm run check` passes with 0 errors
- [ ] No `any` types — use proper interfaces
- [ ] New interfaces/types go in `src/lib/types.ts` if shared, or local if component-specific
- [ ] Imports use `$lib/` aliases, not relative paths crossing module boundaries

### Svelte 5

- [ ] Uses runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable` — not Svelte 4 stores
- [ ] Props declared with `$props()` and typed inline
- [ ] Reactive derivations use `$derived` or `$derived.by()`, not `$:` labels
- [ ] Effects use `$effect()`, not `afterUpdate` or reactive statements

### Testing

- [ ] New pure functions have tests (Vitest, `describe`/`it` blocks)
- [ ] Tests verify behavior through public interfaces, not implementation details
- [ ] `npx vitest run` passes — all existing tests still green

### Persistence

- [ ] localStorage writes are debounced where appropriate (inputs, frequent updates)
- [ ] No unbounded localStorage growth — enforce limits where data can accumulate (recordings, documents)
- [ ] Conversation data is keyed by show slug, not bot ID

### Security

- [ ] User input is sanitized before rendering as HTML (DOMPurify for markdown)
- [ ] API endpoints validate input types and lengths
- [ ] No secrets or API keys in client-side code

### Commits

- [ ] Concise imperative message ("Add X", "Fix Y", "Update Z")
- [ ] No Co-Authored-By or trailer lines
- [ ] Changes are on the correct branch

---

## How to use

### As a standalone review

```
/review-code
```

Reviews the current `git diff` against all checklists above.

### Within an agent's workflow

Before committing, the agent should mentally walk through each applicable checklist item. If a section doesn't apply to the change (e.g., no new app was added), skip it. Focus on the items relevant to what changed.

### Output format

Report findings as:

- PASS — requirement met
- FAIL — requirement violated (must fix before commit)
- WARN — not ideal but not blocking
- SKIP — not applicable to this change

Only list FAILs and WARNs in the output. If everything passes, say so in one line.
