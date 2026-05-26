# Terminal

A retro desktop you visit in a browser. It looks like what the inside of a computer looked like before screens got slick — striped title bars, chunky icons, draggable windows.

Open TV Guide to see what's on. Channels run shows on a schedule like mid-80s cable. If a show is airing, you can chat with the characters — they know what episode they're in.

Built with SvelteKit, deployed on Cloudflare Pages.

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
