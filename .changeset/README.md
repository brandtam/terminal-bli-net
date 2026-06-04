# Changesets

Changesets track release-worthy changes before they are merged into `CHANGELOG.md`.
They are committed with feature and fix PRs, accumulate on `main`, and are archived after
a release instead of being deleted.

## Lifecycle

1. During a PR, ask the agent to write one `.changeset/*.md` file for the final
   user-facing change with `$write-change-set`, or create it manually.
2. On `main`, pending changesets sit in `.changeset/` until a release is prepared.
3. Use `$prepare-release` to preview and prepare the next release, or run
   `pnpm changeset:version -- --dry-run` manually.
4. Run `pnpm changeset:version -- --yes` from a clean working tree to bump
   `package.json`, prepend `CHANGELOG.md`, and move consumed files to
   `.changeset/released/<version>/`.
5. Commit the release files, tag `vX.Y.Z`, verify deployment, and publish a GitHub
   Release using the matching changelog entry.

## Format

```markdown
---
type: minor
category: Added
link: #123
---

Add folder-addressable Finder windows

- Desktop folder aliases now open the folder the user clicked.
- Existing Finder and Trash window ids remain compatible with saved layouts.
```

## Fields

| Field      | Required | Purpose                                                                                            |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| `type`     | Yes      | SemVer impact: `major`, `minor`, or `patch`. Highest pending type wins the release bump.           |
| `category` | No       | Changelog section. Defaults by type: `minor` -> `Added`, `patch` -> `Fixed`, `major` -> `Changed`. |
| `link`     | No       | A PR, issue, or discussion link to include in the changelog entry.                                 |

## Categories

Use Keep a Changelog categories when possible:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

Terminal also allows:

- `Migration Notes` for localStorage, IndexedDB, backup, restore, or data migration behavior.
- `App Author Notes` for app manifest, AppContext, document routing, or add-on contract changes.
- `Known Issues` for intentional release limitations.
- `Upgrade Notes` for self-hosting or deployment actions.

## Type Rules

| Type    | Use for                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `major` | Breaking app/add-on contracts, destructive storage changes, removed public workflows, or dropped documented runtime support.          |
| `minor` | New apps, new user workflows, new document handlers, backward-compatible app contract additions, or substantial visible improvements. |
| `patch` | Bug fixes, security fixes without public contract changes, visual corrections, copy fixes, and compatible dependency/runtime fixes.   |

## Commands

| Task                               | Command                               |
| ---------------------------------- | ------------------------------------- |
| Create a changeset interactively   | `pnpm changeset:add`                  |
| Validate pending changesets        | `pnpm changeset:check`                |
| Validate current PR has changesets | `pnpm changeset:check-pr`             |
| Preview pending release            | `pnpm changeset:status`               |
| Preview version/changelog mutation | `pnpm changeset:version -- --dry-run` |
| Consume pending changesets         | `pnpm changeset:version -- --yes`     |

## Skip Changesets For

- Test-only changes.
- Internal refactors with no behavior or public contract change.
- Formatting-only changes.
- Internal documentation typo fixes.
- Dependency lockfile churn with no shipped effect.

When in doubt, add a changeset. A short, accurate release note is cheaper than
rediscovering why a visible behavior changed later.
