# Restore is command-atomic, not crash-atomic

Terminal OS backup restore replaces the local disk manifest and any out-of-line file bodies, so a failed restore must not leave the running system half-restored. We will make restore command-atomic for normal returned failures: invalid backups, decode errors, quota failures, and predictable storage failures should leave the current disk unchanged and tell the user the restore did not apply.

We are not promising browser-crash atomicity for this slice. The current persistence model spans localStorage for the manifest and IndexedDB for binary bodies, and the browser does not give us a single transaction across those stores. If the tab is killed, the browser crashes, or site storage is externally corrupted while restore is in flight, recovery is operational rather than transactional: reload Terminal OS, retry the restore from the backup file, and if the app cannot boot cleanly, clear/reinstall the local Terminal OS disk and restore from the backup file again.

The restore failure UI should include this recovery instruction in concise form. The backup file is the source of truth during recovery; the partially written local disk is not.

The body store should expose a bulk replacement primitive for restore, rather than making `TerminalFS` compose `clear()` plus repeated `write()` calls as the architectural pattern. `TerminalFS` owns the restore workflow and validation, but the storage adapter owns replacing the complete body set with the strongest atomicity its backing store can provide. For IndexedDB, that means staging body entries outside the active store, then swapping staging into the active store in one transaction.

`replaceAll` replaces all bodies in the Terminal OS body store. Restore is a full Terminal HD disk-image replacement, not a per-app or per-folder merge.

Performance and bounded resource use are first-class architectural qualities for Terminal OS, not afterthoughts. Restore should preserve the clean command-atomic model while keeping data movement explicit and bounded at the module interfaces. In this slice, the current JSON/base64 backup format already means the selected backup file is read and parsed in the client, but the body-store replacement interface should not require callers to materialize a second full copy of every decoded body. Future backup formats should be able to feed the same restore workflow through an iterator or stream-shaped source without changing the higher-level restore contract.

The IndexedDB adapter stages async body entries into a staging object store, then swaps staging into the active body store in one transaction. `TerminalFS` saves the staged manifest first, runs body replacement second, and rolls the manifest back if replacement fails. That ordering avoids keeping a second copy of the old body store in JavaScript memory while still preserving command-level all-or-nothing behavior for normal returned failures.
