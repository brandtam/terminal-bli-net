---
type: patch
category: Security
---

Close a chat spend-cap bypass and repair reminder email links

- Keep reading the provider stream after a client disconnects, so a hung-up request settles to its actual cost instead of counting as $0 against the spend ceilings.
- Point the reminder Worker's confirm link and catalog fetch at `terminal.bli.net`; `bli.net` no longer serves the app, so new subscribers could not confirm and reminder runs could not load the schedule.
