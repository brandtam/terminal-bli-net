# Changeset and Release Process

Terminal uses a custom changeset workflow for release notes and versioning.
It follows the same core idea as common changeset tools: each release-worthy PR
carries a small markdown file that describes the final user-facing change and its
SemVer impact. The difference is that Terminal archives consumed changesets under
`.changeset/released/<version>/` instead of deleting them.

For the full architecture and skill workflow, see
[`docs/changeset-architecture.html`](./changeset-architecture.html).

## Why This Exists

Git commit history is written for developers. A changelog is written for humans
trying to understand what changed between releases. Terminal needs both:

- Git history preserves implementation steps.
- Changesets preserve release intent at PR time.
- `CHANGELOG.md` preserves public release history.
- Git tags and GitHub Releases preserve immutable release snapshots.

## File Layout

```text
.changeset/
  README.md
  add-some-feature.md          # pending release note
  released/
    1.1.0/
      previous-feature.md      # archived release note
CHANGELOG.md                   # generated and edited public ledger
scripts/changesets.js          # CLI entry point
scripts/lib/changesets.js      # parser, validator, versioning, changelog writer
```

## PR Author Workflow

1. Build the feature or fix.
2. Ask the agent to write or update one changeset for the PR:

```text
$write-change-set
```

3. Run `pnpm changeset:check-pr` when the PR is release-worthy, or
   `pnpm changeset:check` for a general validation pass.
4. Include the changeset in the PR.

Manual fallback:

```bash
pnpm changeset:add
```

or create the file manually in `.changeset/`.

The changeset should describe the final state of the PR, not every intermediate
step. If the PR changes while under review, update the same changeset.

## Reviewer Workflow

Reviewers should check:

- A visible behavior change has a changeset.
- The `type` matches the SemVer impact.
- The `category` will land in the right changelog section.
- The first line is clear to someone who did not read the diff.
- Storage, backup, restore, document routing, or app/add-on contract changes also
  update docs and in-app copy where needed.

Missing changesets are fine for internal-only work, but the PR should say why the
change type is `none`.

For PRs marked `major`, `minor`, or `patch`, use:

```bash
pnpm changeset:check-pr
```

That command validates branch-local changesets and fails if none are present.

It compares the branch against `origin/main`, so that ref must exist locally —
run `git fetch origin` first. On a shallow clone, a fork, or a remote not named
`origin`, the diff cannot resolve and the command fails even when a valid
changeset is present. When this workflow runs in CI, fetch enough history (or
point it at the right base ref) before calling `check-pr`.

## Release Maintainer Workflow

Agent workflow:

```text
$prepare-release
```

Preview the pending release:

```bash
pnpm changeset:version -- --dry-run
```

If the preview is correct, consume changesets from a clean working tree:

```bash
pnpm changeset:version -- --yes
```

This command:

1. Reads pending `.changeset/*.md` files.
2. Validates frontmatter and summaries.
3. Computes the highest SemVer bump.
4. Prepends a generated entry to `CHANGELOG.md`.
5. Updates `package.json`.
6. Moves consumed changesets to `.changeset/released/<version>/`.

Review the generated changelog before committing. It is acceptable to edit
wording and grouping after generation, but keep the archived changesets as the
source notes that produced the release.

Steps 4–6 are not a single atomic operation. The clean-working-tree requirement
is the recovery mechanism: if any step fails partway, the only changes on disk
are the ones this command just made, so

```bash
git checkout -- CHANGELOG.md package.json .changeset
git clean -fd .changeset/released
```

restores the pre-release state. Run the command again once the cause is fixed.
This is also why you must not re-run `--yes` after a partial failure without
resetting first — a second run would consume the same changesets again and
duplicate the changelog entry.

## Tags and GitHub Releases

After the release commit lands and production deployment is verified:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Create a GitHub Release from that tag. Use the matching `CHANGELOG.md` section as
the release body, then add screenshots, migration notes, or operational context
when that helps users.

Do not move published release tags. If a release is wrong, ship a new patch
version.

## Automation, Agents, and GitHub Actions

No GitHub Action is required for the initial workflow. The source of truth is the
repo-local CLI plus the committed files:

- `pnpm changeset:check-pr` for release-worthy PRs.
- `pnpm changeset:version -- --dry-run` before release.
- `pnpm changeset:version -- --yes` to consume pending changesets.
- `.changeset/released/<version>/` for archived release-intent files.

Agents should follow `AGENTS.md`, this document, `.changeset/README.md`, and the
installed `$write-change-set` / `$prepare-release` skills.
Every release-worthy user-facing, app-author-facing, storage, deploy, or public
documentation change should include exactly one updated changeset for the final
state of the PR.

Optional automation can be added later:

- A PR workflow that runs `pnpm changeset:check-pr` when the change type is not
  `None`.
- A release workflow that reads the current `package.json` version, extracts the
  matching `CHANGELOG.md` section, and creates a GitHub Release.
- A deploy-aware release workflow that waits for Cloudflare production
  verification before tagging or publishing a release.

Keep these optional until they reduce real maintainer work. The manual workflow
is deliberately complete without them.

## Changeset Format

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

The first body line becomes the bold changelog summary. Remaining lines are kept
as details.

## SemVer Policy

Terminal's public surface includes user workflows, browser persistence behavior,
backup/restore behavior, the app manifest contract, AppContext, document routing,
deployment expectations, and documented app-author APIs.

Use `major` for:

- Breaking app/add-on manifest or AppContext contracts.
- Storage or backup format changes that require user action or cannot be safely
  restored.
- Removed public workflows or released apps.
- Dropped documented browser/runtime support.

Use `minor` for:

- New apps, windows, document handlers, menus, settings, or workflows.
- Backward-compatible app/add-on contract additions.
- Deprecations that warn before removal.
- Substantial visible improvements.

Use `patch` for:

- Bug fixes.
- Security fixes that preserve public contracts.
- Visual, copy, or browser compatibility fixes.
- Runtime/dependency fixes that preserve behavior.

## Changelog Policy

`CHANGELOG.md` is the public release ledger. Keep entries reverse chronological.
Each version should include a date and only the sections that have content.

Preferred sections:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`
- `Migration Notes`
- `App Author Notes`
- `Known Issues`
- `Upgrade Notes`

## Source References

The workflow is tailored for this repository and informed by:

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [GitHub generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [Changesets concepts](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
