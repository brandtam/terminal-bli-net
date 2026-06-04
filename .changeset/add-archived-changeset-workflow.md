---
type: minor
category: Added
---

Add an archived changeset and changelog workflow

- Add a repo-native `pnpm changeset` CLI for creating, validating, previewing, and consuming release notes.
- Add `pnpm start-here` and `pnpm run help` so returning maintainers can rediscover the branch, PR, change-set, and release workflow from the terminal.
- Generate Keep a Changelog-style release entries from pending `.changeset/*.md` files.
- Archive consumed changesets under `.changeset/released/<version>/` so release-intent notes remain inspectable after a changelog entry is created.
- Document PR author, reviewer, and release maintainer responsibilities for the new workflow.
