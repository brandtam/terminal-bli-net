# Example apps

Complete, working app templates you copy into the project to start your own. Each folder is a self-contained starting point — pick the one closest to what you want and adapt it.

These examples are **not wired into the build** and don't ship in the hosted OS. They live here as clean references so the shipped app list stays real. To run one, you copy it into the app tree and add a manifest entry (each example's README has the exact steps).

## How to use an example

1. Copy the example's component folder into `src/lib/apps/<your-app>/`.
2. Add a `defineApp({...})` entry to the `MANIFESTS` array in `src/lib/terminalos/apps/manifests.ts` — the example's README gives you the block to paste.
3. `pnpm dev`, then launch your app from the Computer Store or `/Applications`.

The full reference — every manifest field, the `AppContext` your component receives, and the document-handler pattern — is in [docs/writing-an-app.md](../docs/writing-an-app.md).

## Available examples

| Example                     | What it shows                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| [hello-world](hello-world/) | The smallest real app: one window, zero props, local state, and a live call into the OS. Start here. |

## Want to add an example?

More involved examples are welcome — an app that records video, snaps a photo, captures audio, or handles a document type. Add a folder here with its own README following the same shape, and list it in the table above.
