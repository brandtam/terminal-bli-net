---
description: "Create or edit a TV channel's 48-slot daily schedule"
---

# Schedule Channel

When this skill is invoked, guide the user through creating or editing a channel schedule for the chatrbot.ai TV Guide.

## Step 1: List existing channels

Read all JSON files in `channels/` and display them as a table:

| Slug | Name | Number | Network | Primary Show |
| ---- | ---- | ------ | ------- | ------------ |

Then ask the user: **Do you want to edit an existing channel or create a new one?**

## Step 2: Channel details

### If creating a new channel

Ask the user for:

- **Channel slug** — kebab-case, e.g. `ch7-hbo`
- **Display name** — e.g. "HBO Classics"
- **Channel number** — integer
- **Network name** — e.g. "HBO"

### If editing an existing channel

Load the channel JSON and confirm which aspects to change (metadata, schedule, or both).

## Step 3: List available shows

Read the `bots/` directory. For each subdirectory that contains a `_meta.json` with an `episodes` array, list the show:

| Show Slug | Name | Episode Count |
| --------- | ---- | ------------- |

Present these to the user and ask which shows to include on this channel. At least one show must be selected.

## Step 4: Choose scheduling mode

Offer two modes:

### Auto-fill mode

Automatically distribute selected shows across all 48 slots (each slot = 30 minutes, covering a full 24-hour day starting at midnight).

Rules for auto-fill:

- The **primary show** (first selected, or user-designated) gets ~60-70% of slots (roughly 29-34 slots).
- Remaining shows split the rest roughly evenly.
- Schedule in **blocks of 2-4 consecutive slots** per show to simulate real TV programming blocks.
- Cycle through each show's episode catalog sequentially so there's variety (don't repeat the same episode).
- Distribute non-primary shows across different parts of the day (don't cluster them all together).

### Manual mode

Walk through the day in time blocks and let the user assign shows:

- **Early Morning** (slots 0-7, midnight-4am)
- **Morning** (slots 8-15, 4am-8am)
- **Daytime** (slots 16-23, 8am-12pm)
- **Afternoon** (slots 24-31, 12pm-4pm)
- **Evening** (slots 32-39, 4pm-8pm)
- **Prime Time** (slots 40-47, 8pm-midnight)

For each block, ask which show(s) to place and how many slots each.

## Step 5: Assign episodes

For each slot, assign a specific `{ showSlug, season, episode }` object from that show's `_meta.json` episodes array.

- Cycle through episodes in catalog order (by season, then episode number).
- Do not repeat an episode within the same channel schedule unless the catalog is exhausted.
- If a show's catalog is exhausted before all its assigned slots are filled, wrap around to the beginning.

## Step 6: Write the channel JSON

Write the file to `channels/{slug}.json` with this exact structure:

```json
{
  "slug": "ch7-hbo",
  "name": "HBO Classics",
  "number": 7,
  "network": "HBO",
  "schedule": [
    { "showSlug": "seinfeld", "season": 1, "episode": 1 },
    ...
  ]
}
```

The `schedule` array must have exactly 48 entries. No nulls.

## Step 7: Validate

Run the channel validation test:

```bash
npx vitest run src/lib/channel-validation.test.ts
```

If validation fails, read the error output and fix the channel JSON. Common issues:

- Wrong episode reference (season/episode combo not in the show's `_meta.json`)
- Missing slots (must be exactly 48)
- Invalid show slug (must match a directory in `bots/` that has `_meta.json`)

Re-run validation until it passes.

## Important constraints

- The `VALID_SHOW_SLUGS` list in `src/lib/channel-validation.test.ts` must include any new show slug. If adding a show not already in that list, update the test file too.
- Channel numbers should not conflict with existing channels.
- Always verify episode references against the actual `_meta.json` — never guess season/episode numbers.
