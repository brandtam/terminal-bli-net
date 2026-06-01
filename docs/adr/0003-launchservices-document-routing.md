# LaunchServices owns document-open routing

Finder and Desktop are filesystem shells, not document-handler registries. They may resolve aliases, navigate folders, and launch app files, but every non-app file open must enter the OS document-open path through `os.openDocument(file)`.

`os.openDocument(file)` delegates to `resolveOpenTarget(file)`, which is the LaunchServices-style resolver for Terminal OS. The resolver chooses a window target in this order: the file's explicit `opensWith` handler, then the file body's content type, then the file's coarse `fileType`, then the file id as an unknown-document fallback.

An app becomes a document handler by declaring `opens` on a manifest window. A prefix window with `opens` is invertible: LaunchServices can mint the handler's document window id from the file id, such as `textedit:<fileId>`, `sticky:<noteId>`, or `player:<fileId>`. Adding a new document handler should therefore be a manifest change plus handler tests, not a Finder or Desktop branch.

`file.appId` is creator or package metadata, not document-open policy. Finder and Desktop must not switch on TextEdit, Stickies, Recorder, or any other app-specific document case. A recording made by Recorder can open in Player because its handler metadata and content type say so; a text file opens in TextEdit because TextEdit declares it handles `fileType:'text'`; a sticky note opens in Stickies because Stickies declares it handles `fileType:'sticky'`.

App-file launching stays separate from document opening. If a filesystem node is a file with `fileType:'app'` and an `appId`, shells should launch the app through `os.launchApp(appId)`. That preserves app install gates and custom launch behavior without mixing application launch with document-handler selection.

Folder behavior also stays caller-owned. Finder opens folders by navigating its current folder view; Desktop may open the Finder or Trash window. That folder policy is explicitly separate from document routing.

Aliases are resolved before classification. Opening an alias should behave as though the user opened its target: a document alias enters `os.openDocument(file)`, an app alias launches the app, and a folder alias uses the caller's folder behavior. Broken or cyclic aliases may no-op or surface shell-specific UI, but they should not become document-routing policy.

Availability and install policy must not move back into Finder or Desktop. The OS/window-open path and manifest model own whether a target app/window is available. Unknown or stale persisted handler ids are tolerated by falling through to content type, file type, or the raw file-id fallback rather than requiring shell-specific compatibility branches.

Regression coverage should protect both layers: `resolveOpenTarget` tests for handler selection, and Finder/Desktop open-policy tests proving the shells use the shared filesystem-open helper and do not reintroduce app-specific document switches.
