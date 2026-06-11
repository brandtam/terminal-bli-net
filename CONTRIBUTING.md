# Contributing

Thanks for poking at Terminal. This is a personal project, but clean contributions are welcome.

## Setup

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

No API keys are needed to boot the OS and look around. Chat features need a key — copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`).

## Before you open a PR

Run the same checks CI does:

```bash
pnpm check        # svelte-check / TypeScript
pnpm lint         # prettier + eslint
pnpm test:unit    # vitest
pnpm test         # playwright (end-to-end)
```

`pnpm format` rewrites files to the prettier config. Keep TypeScript strict — no `any`, no `@ts-ignore`, no stray `console.log`.

## Writing an app

Apps are first-class and don't touch OS code. See **[Writing an app](docs/writing-an-app.md)** and the **[Hello World example](examples/hello-world/)**. New bots and channels are plain JSON under `bots/` and `channels/`; `pnpm lint:bots` validates them.

## Commits

Small, focused commits with a clear subject line. If a change is user-facing or release-worthy, add a changeset (`pnpm changeset`) so it lands in the changelog.

## Content & IP

Terminal is a fan/parody project (see the disclaimer in the README). Don't add copyrighted assets — no real show stills, logos, network marks, or transcript dumps. Bot avatars use placeholder stubs or original art; character prompts are original paraphrase, not copied scripts. PRs that bundle third-party copyrighted material won't be merged.

## Reporting bugs

Use the issue templates under [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE/). For security issues, see [SECURITY.md](SECURITY.md) — don't open a public issue.
