# Terminal

A retro desktop you visit in a browser. It looks like what the inside of a computer looked like before screens got slick — striped title bars, chunky icons, draggable windows.

Open TV Guide to see what's on. Channels run shows on a schedule like mid-80s cable. If a show is airing, you can chat with the characters — they know what episode they're in.

Built with SvelteKit, deployed on Cloudflare Pages.

## Architecture docs

- [TerminalOS architecture](docs/terminalos-architecture.md) maps the browser OS layers, storage model, window host, app manifest/add-on contract, and current follow-ups.
- [Feature-readiness PRD](docs/prd/terminalos-feature-readiness.md) defines the remaining work before the next app/game push.
- [ADRs](docs/adr/) record load-bearing decisions, including manifest-driven apps, LaunchServices document routing, backup/restore atomicity, and blob body lifecycle.

Terminal HD stores its filesystem manifest and preferences in localStorage, with binary file bodies in IndexedDB. Clearing browser site data removes both; use the in-OS backup/restore flow before clearing storage.

## Setup

```bash
pnpm install
cp .env.example .env  # add your ANTHROPIC_API_KEY
pnpm dev
```

## Deploy

Deployed to Cloudflare Pages. Secrets (`ANTHROPIC_API_KEY`, optionally `OPENAI_API_KEY`) are set via the Pages dashboard or `wrangler secret put`.

## License

[MIT](LICENSE.md)
