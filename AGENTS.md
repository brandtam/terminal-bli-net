## PR and commit rules

- Never add "Generated with Claude Code" or any AI attribution lines to PR descriptions or commit messages.
- Never add Co-Authored-By trailer lines to commits.

## Project docs

- Start architecture work with `docs/terminalos-architecture.md`.
- Check `docs/adr/` before changing filesystem persistence, document routing, or app/add-on registration.
- Terminal HD stores its manifest/preferences in localStorage and blob file bodies in IndexedDB; update both docs and in-app copy if that storage model changes.
- Use `docs/start-here.md` or `pnpm start-here` when the user asks how to get oriented, resume work, create a PR, write a change set, or prepare a release.
- Add or update one `.changeset/*.md` file for every release-worthy user-facing, app-author-facing, storage, deploy, or public documentation change. Use `docs/changesets.md` and `.changeset/README.md` for the workflow.

## Svelte MCP

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
