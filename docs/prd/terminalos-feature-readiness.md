# TerminalOS Feature Readiness PRD

## Problem Statement

TerminalOS is ready to shift from architectural cleanup into feature work: new apps, games, and more playful desktop experiences. The core architecture is now strong enough for that direction, but several remaining issues will slow or confuse feature development if left in place.

From the user's perspective, the next phase should feel like adding software to an operating system, not editing the OS shell for every app. Apps should launch consistently from the Desktop, Dock, Finder, My Shelf, and document opens. Folder opens should target the folder the user clicked. Unknown documents should produce a clear OS response. Window focus and drag/drop behavior should match the visible desktop state. The implementation should preserve the existing manifest-driven architecture while closing the remaining leaks.

## Solution

Complete a single feature-readiness pass that makes the app/add-on system reliable enough for ongoing app and game development.

The pass will:

1. Move custom launch behavior into the manifest/add-on layer.
2. Make installed Dock entries launch every installed app, including custom-launch apps.
3. Add folder-addressable Finder windows so Desktop folder opens preserve target folder intent.
4. Replace unknown-document dead windows with a clear OS-level alert.
5. Promote the next frontmost window when the active window closes.
6. Make drag/drop affordances reject folder-into-descendant drops before the filesystem failure alert.
7. Add conformance coverage for Computer Store catalog drift.
8. Add browser-flow tests for persistence, store lifecycle, and document routing.

This is a readiness pass, not the first new game. After this work, the next app or game should be able to follow the documented add-on path.

## User Stories

1. As a site owner, I want new fixed-window apps to be added through manifests, so that future apps do not require OS render branches.
2. As a site owner, I want custom-launch apps to be declared through the same app system, so that apps like TextEdit, Stickies, and Chatrbot do not require special Desktop wiring.
3. As an app author, I want a launch strategy in the app declaration, so that I can tell TerminalOS whether an app opens a fixed window or runs custom launch logic.
4. As an app author, I want app-local launch handlers, so that launch behavior lives near app behavior instead of in the root desktop shell.
5. As an app author, I want the compiler and tests to prove every released app is launchable, so that store apps cannot become half-registered.
6. As a desktop user, I want every installed app to appear and launch correctly from the Dock, so that installed software is reachable from the expected OS surface.
7. As a desktop user, I want Dock entries for custom-launch apps to work, so that TextEdit, Stickies, and similar apps are not silently missing or inert.
8. As a desktop user, I want active Dock indicators to remain useful for fixed-window and custom-launch apps, so that I can tell what is already open.
9. As a Finder user, I want double-clicking a Desktop folder to open that folder, so that the OS respects the thing I clicked.
10. As a Finder user, I want folder aliases to open their target folders, so that aliases behave like the target.
11. As a Finder user, I want opening Terminal HD to show Terminal HD, even if another Finder window was previously navigated elsewhere.
12. As a Finder user, I want Trash to keep opening Trash, so that existing Desktop and Dock behavior does not regress.
13. As a returning user, I want old persisted `finder` and `trash` windows to remain compatible, so that existing saved layouts do not break.
14. As a document user, I want files with known handlers to keep opening in the right app, so that README, stickies, and recordings behave as before.
15. As a document user, I want unknown files to show a clear "no app can open this" message, so that I do not see a misleading "Coming soon" window.
16. As a desktop user, I want closing the active window to focus the next visible frontmost window, so that the menu bar matches what I see.
17. As a desktop user, I want closing the last window to return focus to Finder, so that the fallback menu remains predictable.
18. As a desktop user, I want invalid drag targets to avoid highlighting, so that the UI does not invite an operation the filesystem will reject.
19. As a desktop user, I want folder-into-descendant drops to be rejected before the drop completes, so that drag/drop feels deliberate.
20. As a store maintainer, I want the Computer Store catalog to be checked against the app catalog, so that sellable apps are not accidentally omitted.
21. As a store maintainer, I want intentional store omissions to be explicit, so that curated store presentation can remain separate without drifting silently.
22. As a tester, I want browser-flow coverage for app purchase and install, so that the user-facing store lifecycle is protected.
23. As a tester, I want browser-flow coverage for reload persistence, so that localStorage and IndexedDB behavior is tested in a real browser.
24. As a tester, I want browser-flow coverage for document routing, so that Finder/Desktop opens exercise LaunchServices in the actual UI.
25. As a future game developer, I want a stable add-on contract before game work begins, so that the first game can focus on gameplay instead of OS plumbing.

## Implementation Decisions

### Manifest-owned launch strategies

Add launch metadata to the app manifest model. The launch strategy should distinguish:

- fixed-window apps: launch opens the app's exact `role: 'app'` window.
- custom-launch apps: launch calls app-local logic with the OS API, filesystem, and optional payload.
- non-launchable apps: coming-soon or catalog-only entries that should not launch.

Derive special-launch detection from manifests. Do not keep a second hardcoded special-launch union.

Move custom launch behavior for TextEdit, Stickies, and Chatrbot out of the Desktop shell and into app-local modules or manifest-owned handlers. The root Desktop may initialize the OS and host windows, but it should not contain app-specific launch branches.

### Dock launch behavior

Change Dock installed-app entries so they can launch through `os.launchApp(appId)` rather than requiring a fixed window id. Fixed-window apps still open their exact windows; custom-launch apps run their manifest-owned launch behavior.

Dock active indicators should remain useful. For fixed-window apps, the existing window id check is enough. For custom-launch apps, derive active state from manifest/window ownership where possible. For apps like TextEdit and Stickies, any open document/note window owned by the app should count as active.

### Folder-addressable Finder

Add folder-addressable Finder windows. The preferred direction is a Finder-owned prefix window such as `finder:<folderId>` with `folderId` available through `ctx.window.args`.

Keep existing exact `finder` and `trash` windows for compatibility with persisted layouts and current system surfaces. New folder-targeted opens should use folder-addressed windows so the target cannot be lost by focusing an already-open singleton Finder window.

Desktop folder opens and folder aliases should route through the shared filesystem-open policy into folder-addressed Finder windows. Terminal HD should target the root folder. Trash may remain exact or become folder-addressed, but the user-facing behavior must stay stable.

### Unknown-document UX

Keep LaunchServices resolver precedence unchanged: explicit handler, content type, file type, fallback. Change the OS open path so a fallback that does not resolve to a known window produces an alert instead of opening a dead window.

The alert should name the file and explain that no installed app can open it. It should not imply the app is coming soon.

### Active-window promotion

When closing the active window, set the active window to the remaining window with the highest z-order. If no windows remain, clear active focus so the menu bar falls back to Finder.

This is a behavior fix in the OS window manager, not an app concern.

### Drag/drop affordance correctness

Keep TerminalFS as the final authority for move validity. Add enough filesystem-aware drop policy for Finder/Desktop hover states to avoid advertising known-invalid folder-into-descendant drops.

The UI should not highlight a target that will fail because it is the dragged folder itself or one of its descendants.

### Store catalog conformance

Keep the Computer Store visual catalog separate if that remains useful for presentation. Add tests that compare it to the app catalog:

- every sellable non-system app is represented, or
- the app is listed in an explicit omission list with a reason.

The test should also catch obvious app id drift.

### Browser-flow coverage

Add Playwright coverage for the flows that unit tests cannot fully prove:

- purchase an app, install it from My Shelf, see the Desktop alias, and launch it.
- uninstall an owned app and verify ownership remains while the app file/alias is removed.
- edit or create a text document, reload, and verify it persists.
- create or restore a blob-backed file path where feasible and verify IndexedDB-backed data survives reload.
- open a text document through Finder/Desktop and verify TextEdit opens.
- open a document alias and verify the same handler route is used.

## Testing Decisions

Good tests should cover behavior at module boundaries and avoid asserting internal implementation details unless the test is a conformance guardrail.

Unit and conformance tests should cover:

- manifest launch strategy derivation.
- released app launchability.
- custom-launch handlers for TextEdit, Stickies, and Chatrbot.
- Dock launch entries for fixed and custom-launch apps.
- folder-addressable Finder routing.
- unknown-document alert behavior.
- active-window promotion after close.
- drag/drop rejection of folder-into-descendant targets.
- Computer Store catalog coverage.

Browser tests should cover user-visible workflows:

- store purchase -> My Shelf install -> Desktop alias -> launch.
- uninstall leaves ownership but removes installed surface.
- localStorage-backed text data persists across reload.
- IndexedDB-backed blob data persists across reload where feasible.
- Finder/Desktop document opens route to the expected handler.

Prior art already exists in:

- manifest conformance tests.
- zero-OS-edit proof tests.
- window host and document resolver tests.
- OS API window management tests.
- filesystem open and drag/drop policy tests.
- app lifecycle model tests.
- Playwright desktop smoke tests.

## Out Of Scope

- Building the first new game.
- Designing an iframe sandbox or permission system.
- Implementing scoped app storage beyond the reserved AppContext handle.
- Replacing the current localStorage plus IndexedDB persistence model.
- Changing backup file format unless needed for tests.
- Reworking Computer Store visuals beyond what catalog conformance requires.
- Full mobile desktop support.

## Detailed Issues

### Issue 1: Manifest-owned launch strategies

Type: AFK

Blocked by: None

What to build:

Add manifest launch metadata and derive all launchability checks from manifests. Move TextEdit, Stickies, and Chatrbot custom launch behavior out of the Desktop shell into app-local launch handlers or manifest-owned launch functions. Keep fixed-window launch behavior working for existing released apps.

Acceptance criteria:

- Released fixed-window apps still launch through their exact app window.
- TextEdit can create a new document, open a selected document, and open README/Pricing through the new custom-launch path.
- Stickies can create a new note and apply color actions through the new custom-launch path.
- Chatrbot can open a show chat through the new custom-launch path.
- `isSpecialLaunchApp` or its replacement is derived from manifest launch metadata.
- Desktop no longer contains app-specific launch handler registrations for TextEdit, Stickies, or Chatrbot.
- Unit tests prove every released app has either a fixed launch window or a custom launch strategy.

### Issue 2: Dock supports custom-launch installed apps

Type: AFK

Blocked by: Issue 1

What to build:

Update installed app data and Dock click behavior so installed custom-launch apps can appear and launch from the Dock without requiring a fixed window id.

Acceptance criteria:

- Fixed-window installed apps still appear in the Dock and open as before.
- Installed custom-launch apps are not silently dropped solely because they lack a fixed app window id.
- Dock clicks route through OS app launch behavior, not direct fixed-window assumptions.
- Dock active indicators work for fixed-window apps.
- Dock active indicators work for custom-launch apps when they own at least one open window.
- Unit tests cover installed app list behavior and Dock launch semantics.

### Issue 3: Folder-addressable Finder windows

Type: AFK

Blocked by: None

What to build:

Add Finder window ids that encode the target folder. Route Desktop folder opens and folder aliases to those window ids. Preserve compatibility for existing exact Finder and Trash windows.

Acceptance criteria:

- Double-clicking a Desktop folder opens a Finder window targeted at that folder.
- Double-clicking a Desktop alias to a folder opens a Finder window targeted at the resolved folder.
- Opening Terminal HD targets the root folder even if another Finder window has navigated elsewhere.
- Opening Trash still targets Trash.
- Old persisted `finder` and `trash` windows still open.
- Finder title/size resolution works for folder-addressed windows.
- Tests cover Desktop folder opens, folder aliases, Terminal HD, Trash, and persisted exact ids.

### Issue 4: Unknown-document alert

Type: AFK

Blocked by: None

What to build:

Change OS document opening so files with no matching handler show a clear alert instead of opening a raw unknown window id.

Acceptance criteria:

- Known text, sticky, and recording/video documents still open through their handlers.
- A file with no explicit handler, content type handler, or file type handler shows an alert.
- The alert includes the file name.
- No "Coming soon" or unknown window is opened for an unhandled document.
- Unit tests cover resolver fallback and OS-level alert behavior.

### Issue 5: Active-window promotion after close

Type: AFK

Blocked by: None

What to build:

Update window close behavior so closing the focused window promotes the remaining highest-z window to active focus.

Acceptance criteria:

- Closing a non-active window leaves the current active window unchanged.
- Closing the active window focuses the remaining highest-z window.
- Closing the last window clears active focus.
- The active app/menu bar follows the promoted window.
- Unit tests cover all three close cases.

### Issue 6: Drag/drop descendant-target affordance

Type: AFK

Blocked by: None

What to build:

Make Finder/Desktop drag-over policy aware enough to avoid highlighting a folder's descendants as valid drop targets. Keep TerminalFS validation as final authority.

Acceptance criteria:

- Dragging a folder over itself is not shown as droppable.
- Dragging a folder over one of its descendants is not shown as droppable.
- Dragging a folder over a valid sibling or unrelated folder remains droppable.
- Dropping into a descendant still fails at the filesystem layer if somehow triggered.
- Unit tests cover UI drop policy and TerminalFS rejection.

### Issue 7: Computer Store catalog conformance

Type: AFK

Blocked by: None

What to build:

Add conformance coverage between the app catalog and Computer Store catalog. Make intentional omissions explicit.

Acceptance criteria:

- Every sellable non-system app is represented in Computer Store data or listed in an explicit omission list with a reason.
- Coming-soon apps may remain represented and tagged as coming soon.
- Deprecated apps are either hidden or explicitly omitted.
- The test catches unknown app ids in store data.
- The test catches accidental omission of newly added sellable apps.

### Issue 8: Browser-flow feature readiness tests

Type: AFK

Blocked by: Issues 1, 2, 3, and 4

What to build:

Add Playwright tests for the main user-visible workflows that will matter before adding more apps/games.

Acceptance criteria:

- Purchase -> My Shelf install -> Desktop alias -> launch is covered.
- Uninstall removes installed surfaces while preserving ownership.
- Text document creation or edit persists across reload.
- Blob-backed persistence is covered where feasible in browser automation.
- Finder/Desktop opening a text document opens TextEdit.
- Opening a document alias uses the same document handler route.
- Tests avoid brittle pixel-perfect assertions and focus on user-visible behavior.

## Recommended Execution Order

1. Issue 1: Manifest-owned launch strategies.
2. Issue 2: Dock supports custom-launch installed apps.
3. Issue 3: Folder-addressable Finder windows.
4. Issue 4: Unknown-document alert.
5. Issue 5: Active-window promotion after close.
6. Issue 6: Drag/drop descendant-target affordance.
7. Issue 7: Computer Store catalog conformance.
8. Issue 8: Browser-flow feature readiness tests.

Issues 3 through 7 can be parallelized after Issue 1 if multiple agents are working. Issue 8 should come last because it should test the settled user-visible behavior.

## Success Criteria

- Adding a new fixed-window app no longer requires OS render or launch code edits.
- Adding a new custom-launch app has a documented manifest/add-on path.
- Finder/Desktop/Dock/My Shelf launch surfaces agree on how apps and folders open.
- Unknown documents produce a clear OS response.
- Window focus and menu bar state match visible window order.
- Store catalog drift is caught in tests.
- Browser-level flows protect the core feature-readiness behavior.
- Full unit suite and build pass.
