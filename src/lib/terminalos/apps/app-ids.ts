import type { MANIFESTS } from './manifests';

/**
 * App id types — the leaf module both the manifest layer and the filesystem
 * layer can import without creating a cycle.
 *
 * Why a separate file: the closed `AppId` union must be DERIVED from the
 * manifests, but the filesystem (`filesystem/types.ts`) is the layer that
 * historically owns the public `AppId` name and is imported everywhere. Having
 * `filesystem/types.ts` re-export straight from `manifests.ts` formed a cycle —
 * `manifests` → `app-manifest` → `$lib/os/os-api` → `app-catalog` →
 * `filesystem/types` → `manifests` — which broke TypeScript's named-export
 * resolution for the re-export. This leaf only imports `MANIFESTS` as a *type*
 * (no runtime edge) and nothing reaches back into the filesystem, so the cycle
 * is gone. `filesystem/types.ts` and `app-catalog.ts` both pull the id types
 * from here.
 */

/**
 * The closed AppId union — the core win of #28. Derived from the manifest ids,
 * so it can never drift from the apps that actually exist. `defineApp` infers
 * each literal `id` and `MANIFESTS` is a plain `const` (not annotated as
 * `TerminalAppManifest[]`, which would widen `id` back to `string`), so this
 * resolves to the real union `'finder' | 'vcr' | 'chatrbot' | …`.
 *
 * Omitting or misnaming an app anywhere that takes an AppId is now a COMPILE
 * error, not a runtime "Coming soon" fallback.
 */
export type AppId = (typeof MANIFESTS)[number]['id'];

/**
 * App ids as stored on disk / in backups — open, may name an app the catalog no
 * longer knows. Use this at every read boundary (`getAppDef`, `getInstalledApps`,
 * `windowAppId`, persisted volume/node fields); narrow to `AppId` only after a
 * successful catalog lookup.
 */
export type PersistedAppId = string;
