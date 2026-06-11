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

## Write an app

Apps are first-class here. Adding one is a single manifest entry plus a zero-prop Svelte component — you never edit OS code.

Clone the **[Hello World example](examples/hello-world/)** to get a working app on your desktop in a few minutes, or read **[Writing an app](docs/writing-an-app.md)** for the full walkthrough — every manifest field, the context your component receives, and the document-handler pattern.

## Architecture docs

- [TerminalOS architecture](docs/terminalos-architecture.md) maps the browser OS layers, storage model, window host, app manifest/add-on contract, and current follow-ups.
- [Feature-readiness PRD](docs/prd/terminalos-feature-readiness.md) defines the remaining work before the next app/game push.
- [ADRs](docs/adr/) record load-bearing decisions, including manifest-driven apps, LaunchServices document routing, backup/restore atomicity, and blob body lifecycle.

Terminal HD stores its filesystem manifest and preferences in localStorage, with binary file bodies in IndexedDB. Clearing browser site data removes both; use the in-OS backup/restore flow before clearing storage.

## Deploy

Deployed to Cloudflare Pages. Secrets (`ANTHROPIC_API_KEY`, optionally `OPENAI_API_KEY`) are set via the Pages dashboard or `wrangler secret put`.

## Disclaimer

Terminal is an unofficial, non-commercial fan/parody project. The chat characters are AI parodies inspired by fictional TV characters; they are not the real people, actors, or studios, and this project is not affiliated with or endorsed by any rights holder. All trademarks and character rights belong to their respective owners.

The MIT license below covers the project's **own source code only** — not the names, likenesses, or marks of any third-party characters, shows, or networks referenced in the bundled sample content.

## License

[MIT](LICENSE.md)
