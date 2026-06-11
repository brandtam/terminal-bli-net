# Terminal

A retro desktop you visit in a browser. It looks like what the inside of a computer looked like before screens got slick — striped title bars, chunky icons, draggable windows.

Open TV Guide to see what's on. Channels run shows on a schedule like mid-80s cable. If a show is airing, you can chat with the characters — they know what episode they're in.

Built with SvelteKit, deployed on Cloudflare Pages.

## Visit it

It's live at **[terminal.bli.net](https://terminal.bli.net)** — open it and poke around. Drag windows, open the TV Guide, dig through Terminal HD. Nothing to install.

## Run it yourself

You don't have to use the hosted version. Clone the repo and you have your own desktop OS running in a browser tab — your filesystem, your apps, all local.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

No API keys needed to boot the OS and look around — keys only turn on the chat features. To enable those, copy `.env.example` to `.env` and add an `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`).

## Coming back later

Run the project help command:

```bash
pnpm start-here
```

It prints the branch, PR, change-set, and release workflow, plus the docs map.
`pnpm help` is pnpm's own help, so this repo also exposes the same guide as
`pnpm run help`.

## Engineering workflow

The normal loop is:

1. Branch from `main`.
2. Build the feature or fix.
3. Run the relevant checks.
4. Open a PR.
5. Add a change set before merge when the PR is release-worthy.
6. Merge PRs into `main`.
7. Prepare a release from accumulated change sets.

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feature/<short-name>
pnpm test:unit
pnpm lint
pnpm build
```

Before merging a release-worthy PR, use the agent skill:

```text
$write-change-set
```

When enough PRs have merged and you are ready to release:

```text
$prepare-release
```

Codex skills use `$skill-name`, not slash commands.

## Useful commands

| Task                        | Command                               |
| --------------------------- | ------------------------------------- |
| Project orientation         | `pnpm start-here`                     |
| Start dev server            | `pnpm dev`                            |
| Type and Svelte checks      | `pnpm check`                          |
| Unit tests                  | `pnpm test:unit`                      |
| Browser tests               | `pnpm test`                           |
| Lint and format check       | `pnpm lint`                           |
| Production build            | `pnpm build`                          |
| Preview pending change sets | `pnpm changeset:status`               |
| Validate current PR note    | `pnpm changeset:check-pr`             |
| Preview release mutation    | `pnpm changeset:version -- --dry-run` |
| Consume change sets         | `pnpm changeset:version -- --yes`     |
| Cloudflare deploy           | `pnpm deploy-cloudflare`              |

## Write an app

Apps are first-class here. Adding one is a single manifest entry plus a zero-prop Svelte component — you never edit OS code.

Clone the **[Hello World example](examples/hello-world/)** to get a working app on your desktop in a few minutes, or read **[Writing an app](docs/writing-an-app.md)** for the full walkthrough — every manifest field, the context your component receives, and the document-handler pattern.

The short version:

1. Add a zero-prop Svelte window under `src/lib/apps/<app>/`.
2. Add a `defineApp({...})` entry in `src/lib/terminalos/apps/manifests.ts`.
3. Use a fixed window for normal apps, or a prefix window plus `opens` for document handlers.
4. Add Computer Store data for store apps.
5. Run the app conformance and catalog tests through `pnpm test:unit`.

## Architecture docs

- [TerminalOS architecture](docs/terminalos-architecture.md) maps the browser OS layers, storage model, window host, app manifest/add-on contract, and current follow-ups.
- [Start Here](docs/start-here.md) is the command-line workflow guide printed by `pnpm start-here`.
- [ChangeSet Architecture](docs/changeset-architecture.html) describes the implemented change-set system, agent skills, release commands, archived notes, tags, and GitHub Releases.
- [Feature-readiness PRD](docs/prd/terminalos-feature-readiness.md) defines the remaining work before the next app/game push.
- [Changeset and release process](docs/changesets.md) explains how release-worthy PRs become changelog entries, version bumps, tags, and GitHub Releases.
- [ADRs](docs/adr/) record load-bearing decisions, including manifest-driven apps, LaunchServices document routing, backup/restore atomicity, and blob body lifecycle.

Terminal HD stores its filesystem manifest and preferences in localStorage, with binary file bodies in IndexedDB. Clearing browser site data removes both; use the in-OS backup/restore flow before clearing storage.

## Deploy

Deployed to Cloudflare Pages. Secrets (`ANTHROPIC_API_KEY`, optionally `OPENAI_API_KEY`) are set via the Pages dashboard or `wrangler secret put`.

## Release notes

Release-worthy PRs include one `.changeset/*.md` file. The agent-first workflow is:

```text
$write-change-set
```

For manual validation, preview pending release notes with:

```bash
pnpm changeset:status
```

For release-worthy PRs, validate the branch-local changeset with
`pnpm changeset:check-pr`.

When preparing a release, use:

```text
$prepare-release
```

For manual release preparation, run `pnpm changeset:version -- --dry-run`, then
`pnpm changeset:version -- --yes` from a clean working tree. Consumed changesets
are archived under `.changeset/released/<version>/`.

## Disclaimer

Terminal is an unofficial, non-commercial fan/parody project. The chat characters are AI parodies inspired by fictional TV characters; they are not the real people, actors, or studios, and this project is not affiliated with or endorsed by any rights holder. All trademarks and character rights belong to their respective owners.

The MIT license below covers the project's **own source code only** — not the names, likenesses, or marks of any third-party characters, shows, or networks referenced in the bundled sample content.

## License

[MIT](LICENSE.md)
