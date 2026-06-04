# Start Here

Use this when returning to the repo after time away.

```bash
pnpm start-here
```

`pnpm help` is pnpm's own built-in help, so this repo uses `pnpm start-here` and
`pnpm run help` for project help.

## First Five Minutes

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>. No API keys are needed to boot the OS. Chat features
need `.env` values.

Check the current work:

```bash
git status
pnpm test:unit
```

## Feature Branch Workflow

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feature/<short-name>
```

Build the change, then run the relevant checks:

```bash
pnpm test:unit
pnpm lint
pnpm build
```

Before merge, make sure the PR carries a change set when the change is
release-worthy:

```text
$write-change-set
```

Manual fallback:

```bash
pnpm changeset:add
pnpm changeset:check-pr
```

Then commit, push, and open the PR:

```bash
git status
git add <files>
git commit -m "<summary>"
git push -u origin HEAD
gh pr create
```

## Adding Apps

Apps are manifest-driven. You normally do not edit OS routing code.

1. Add a zero-prop Svelte window under `src/lib/apps/<app>/`.
2. Add a `defineApp({...})` entry in `src/lib/terminalos/apps/manifests.ts`.
3. Use an exact window for fixed apps, or a prefix window plus `opens` for document handlers.
4. Add Computer Store data for store apps.
5. Run the app conformance and catalog tests through `pnpm test:unit`.

Read `docs/writing-an-app.md` for the full walkthrough.

## Release Workflow

After one or more PRs have merged and pending files exist in `.changeset/`, prepare
the release with the agent skill:

```text
$prepare-release
```

Manual fallback:

```bash
pnpm changeset:status
pnpm changeset:version -- --dry-run
pnpm test:unit
pnpm build
pnpm changeset:version -- --yes
```

After reviewing generated release files:

```bash
git add package.json CHANGELOG.md .changeset/
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
```

Verify production before publishing the GitHub Release.

## Agent Skills

Codex skills use `$skill-name`, not slash commands.

- `$write-change-set` writes or updates the PR's `.changeset/*.md` file.
- `$prepare-release` previews and prepares a release from pending change sets.

Plain-language prompts also work:

```text
Write the change set for this PR.
Prepare the next release from pending change sets.
```

## Docs Map

- `docs/terminalos-architecture.md` explains the OS architecture.
- `docs/writing-an-app.md` explains how to add apps and document handlers.
- `docs/changeset-architecture.html` explains the implemented ChangeSet system.
- `docs/changesets.md` is the compact changeset and release process.
- `.changeset/README.md` documents the change-set file format.
- `docs/adr/` records load-bearing architecture decisions.
