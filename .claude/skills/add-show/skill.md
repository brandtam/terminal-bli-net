---
description: "Add a new TV show with cast and episode catalog to the bots/ directory"
---

# Add Show

When this skill is invoked, guide the user through creating a new TV show for the chatr bot system. This is an interactive, multi-step process.

## Step 1: Gather Show Metadata

Ask the user for the following details (all in one question is fine):

- **Show name** — the display title (e.g. "Seinfeld")
- **Slug** — kebab-case directory name, or derive it from the show name (e.g. "seinfeld")
- **Short description** — 1-2 sentences describing the show's premise
- **Setting** — location where the show takes place (e.g. "Upper West Side, New York City")
- **Era** — decade or time period (e.g. "1990s")
- **Color** — hex color for the TV Guide accent (e.g. "#f5c518")

## Step 2: Add Cast Members

For each character, ask the user for:

- **Character ID** — kebab-case slug used as the filename (e.g. "jerry")
- **Full name** — display name (e.g. "Jerry Seinfeld")
- **Occupation** — short role description (e.g. "Comedian")
- **Bio** — 1-2 sentences for the character card
- **Greeting** — a short in-character line shown when chat opens

Then generate the full `prompt` field yourself following this exact structure:

```
# Character
{name}, {occupation}, {setting}, {era}. {personality summary in 1-2 sentences}

# Voice
- {speech pattern or verbal tic}
- {vocabulary or tone note}
- {relationship to other characters}
- {any other distinctive mannerism}

# Examples
User: {example message}
{name}: {example response}

User: {another example}
{name}: {another response}

User: {third example}
{name}: {third response}

# Format
Reply as {name} in conversation. One to three sentences. Stay in character; if pressed on meta topics, deflect in character.
```

Show the generated prompt to the user for approval. Then ask if they want to add another character or move on.

## Step 3: Generate Episode Catalog

Ask how many episodes to include (suggest 20-24 as default). Then generate episodes with:

- `season` — positive integer
- `episode` — positive integer (episode number within that season)
- `title` — the actual episode title
- `year` — string, the year it aired (e.g. "1993")
- `premise` — 1-2 sentence description of the episode plot (must be at least 20 characters)

Pick episodes that span the show's full run and represent its range — mix iconic episodes with solid deep cuts. Episodes should be in chronological order.

Show the episode list to the user for approval before writing files.

## Step 4: Write Files

Create the following files:

### `bots/{slug}/_meta.json`

```json
{
  "slug": "{slug}",
  "name": "{name}",
  "description": "{description}",
  "setting": "{setting}",
  "era": "{era}",
  "image": "/bots/{slug}/group-icon.png",
  "active": true,
  "color": "{color}",
  "episodes": [...]
}
```

Note: Do NOT include a `schedule` field. That is legacy and not added to new shows.

### `bots/{slug}/{character-id}.json` (one per character)

```json
{
  "id": "{character-id}",
  "group": "{slug}",
  "name": "{full name}",
  "occupation": "{occupation}",
  "image": "/bots/{slug}/{character-id}.jpg",
  "bio": "{bio}",
  "greeting": "{greeting}",
  "prompt": "{the full prompt text}"
}
```

## Step 5: Validate

Run the episode catalog test to confirm the new show passes validation:

```bash
npx vitest run src/lib/episode-catalog.test.ts
```

If it fails, fix the issue and re-run until it passes.

## Important Notes

- Image paths are placeholders — the user will add actual images later
- All JSON must be valid and properly formatted (use 2-space indentation)
- The `prompt` field in character JSON is a single string with `\n` for newlines
- Episode premises must be at least 20 characters (test enforces this)
- Season and episode numbers must be positive integers (test enforces this)
