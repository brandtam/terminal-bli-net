# Security Policy

## Supported versions

Terminal ships from `main`; the live site at [terminal.bli.net](https://terminal.bli.net) always runs the latest release. Fixes land on `main` — there are no maintained back-release branches.

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

- Use GitHub's [private vulnerability reporting](https://github.com/brandtam/terminal-bli-net/security/advisories/new) (Security tab → Report a vulnerability), or
- Email **brandt@bli.dev** with details.

Include what you found, how to reproduce it, and the impact you think it has. I'll acknowledge the report and follow up with a fix or an explanation.

## Scope

Most relevant to this project:

- The chat API route (`src/routes/api/chat/`) and the email reminder Worker (`workers/reminder-agent/`) — anything touching server-side LLM calls, spend limits, or stored secrets.
- Client-side injection via rendered Markdown or bot output.
- Auth/abuse paths that could run up API spend on the live site.

Out of scope: the parody/IP framing of the bundled content (that's a content decision, not a vulnerability), and findings that require a compromised user device or browser.
