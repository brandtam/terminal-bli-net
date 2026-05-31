# Blob bodies are immutable TerminalFS-owned records

Blob-backed files point at immutable body records owned by TerminalFS. Duplicating a blob-backed file or folder shares the same `bodyId` rather than copying bytes; if a future operation edits or replaces a blob file, TerminalFS allocates a new body record and updates that file's `bodyRef` instead of mutating shared bytes in place.

This gives duplicate and folder-copy operations predictable resource behavior while preserving file semantics through copy-on-write. It also means body deletion must be reachability-based: a body record may be removed only after no remaining filesystem node references it.

`deleteNode` remains undoable. When a blob-backed node is deleted through `deleteNode`, TerminalFS must retain any bodies needed by the pending undo record. Body cleanup may run only when those bytes are no longer reachable from the live manifest or pending undo state.

Body garbage collection is a TerminalFS invariant and should run opportunistically whenever body reachability can change, especially when `lastUndo` is assigned, cleared, or replaced. Reachability includes every live filesystem node plus any nodes retained inside the pending undo record. Apps must not delete body records manually to make a file delete "complete."

Body cleanup is eventual and accountable, not casually best-effort. TerminalFS must never trade live manifest/body correctness for storage reclamation: body creation and body replacement are command-blocking because missing bytes corrupt live files, but cleanup of unreachable bodies is retryable maintenance. If GC fails after a manifest command succeeds, the user-visible command may still succeed because the remaining problem is leaked storage, not a dangling live file. The failure should be observable and retried by TerminalFS on later reachability-changing operations.

TerminalFS should expose `collectGarbage()` as a public maintenance command for OS-level diagnostics, startup health checks, and future repair UI. This does not shift lifecycle responsibility to apps: TerminalFS still runs GC internally after reachability changes, and apps must not call `collectGarbage()` after deleting a file to make deletion correct.

`collectGarbage()` should scan the full body graph each time, not only retry known-pending IDs. A full scan is repair-capable: it can clean up historical leaks from older code paths and proves the invariant from durable state rather than trusting an in-memory queue.

Full graph GC requires body-store enumeration. `BodyStore` should expose a body-ID listing operation so TerminalFS can compare all stored bodies against the reachable set without reading every blob's bytes.

Automatic GC should run after manifest persistence succeeds, not before. The durable manifest is the source of truth for reachability; deleting bodies before a manifest save succeeds can leave the old manifest pointing at missing bytes. If manifest persistence fails, TerminalFS should return the persistence failure and skip cleanup.

Automatic GC should run when it matters, not after every manifest write. Commands that can shrink body reachability or clear/replace undo retention should trigger it after a successful manifest commit. Routine commands such as rename, move, app purchase, and inline-text edits should not pay for a full body-store scan. The public `collectGarbage()` command remains available for explicit repair or diagnostics scans.
