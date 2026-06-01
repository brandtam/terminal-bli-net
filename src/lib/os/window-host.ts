import type { Component } from 'svelte';
import type { FileType, FsFile } from '$lib/terminalos';
import type { WindowSpec } from '$lib/terminalos/apps/app-manifest';
import { MANIFESTS } from '$lib/terminalos/apps/manifests';
import { matchWindow } from '$lib/terminalos/apps/app-catalog';
import { resolutionCache } from './window-host-cache';

// invalidateWindow lives in the leaf cache module (so app state can invalidate
// without importing this file's heavy graph); re-export it here for the existing
// call sites that reach for it via window-host.
export { invalidateWindow } from './window-host-cache';

/** Window components take no props, so every loader has the same shape. */
export type WindowComponentLoader = () => Promise<{ default: Component }>;

export type ResolvedWindow = {
	/** App that owns this window. */
	appId: string;
	/** Args the matcher parsed from the id (empty for an exact window with none). */
	args: Record<string, string>;
	/** The matched spec. resolveWindow returns null rather than a null spec. */
	spec: WindowSpec;
	/** Lazy component loader for this window. */
	load: WindowComponentLoader;
};

const cache = resolutionCache;

/**
 * Resolve a window-id to { args, spec, load }, memoized by id so a window's
 * `{#await load()}` keeps the same promise across unrelated reactive ticks and
 * never remounts mid-life. Every window is flat, so this is purely matchWindow —
 * an id no manifest claims returns null (a stale/unknown saved id).
 *
 * Windows whose component depends on app state (the VCR's device) must call
 * `invalidateWindow(id)` when that state changes, so the next resolve re-runs.
 */
export function resolveWindow(id: string): ResolvedWindow | null {
	const cached = cache.get(id);
	if (cached !== undefined) return cached;

	const m = matchWindow(id);
	const resolved: ResolvedWindow | null = m
		? { appId: m.appId, args: m.args, spec: m.spec, load: m.spec.component }
		: null;
	cache.set(id, resolved);
	return resolved;
}

// ── Document open routing (LaunchServices) ───────────────────────────────────

export type DocumentOpener = { appId: string; spec: WindowSpec };

function buildOpeners(): {
	byContentType: Map<string, DocumentOpener>;
	byFileType: Map<FileType, DocumentOpener>;
} {
	const byContentType = new Map<string, DocumentOpener>();
	const byFileType = new Map<FileType, DocumentOpener>();
	for (const m of MANIFESTS) {
		for (const w of m.windows ?? []) {
			if (!w.opens) continue;
			for (const ct of w.opens.contentTypes ?? []) {
				const prior = byContentType.get(ct);
				if (prior) {
					throw new Error(`Two apps claim content-type "${ct}": "${prior.appId}" and "${m.id}"`);
				}
				byContentType.set(ct, { appId: m.id, spec: w });
			}
			for (const ft of w.opens.fileTypes ?? []) {
				const prior = byFileType.get(ft);
				if (prior) {
					throw new Error(`Two apps claim fileType "${ft}": "${prior.appId}" and "${m.id}"`);
				}
				byFileType.set(ft, { appId: m.id, spec: w });
			}
		}
	}
	return { byContentType, byFileType };
}

/**
 * Content-type → handler and fileType → handler, built once from the manifests'
 * `opens` declarations. Throws at module load if two apps claim the same type,
 * so a routing conflict fails loudly instead of silently picking one. Consumed
 * by resolveOpenTarget / os.openDocument.
 */
export const { byContentType: OPENERS_BY_CONTENT_TYPE, byFileType: OPENERS_BY_FILETYPE } =
	buildOpeners();

/** Build a window-id for `spec` opening `fileId` (prefix windows mint instances). */
function mintWindowId(spec: WindowSpec, fileId: string): string {
	return spec.match.kind === 'prefix' ? spec.match.prefix + fileId : spec.match.id;
}

/** The handler app's document window-id for a file, or null if it has none. */
function handlerWindowId(appId: string, fileId: string): string | null {
	const m = MANIFESTS.find((x) => x.id === appId);
	// Only a window that explicitly declares `opens` handles documents. An app
	// with a prefix window but no `opens` (e.g. chatrbot's `chat:` launch window)
	// is NOT a document handler, so there is no fallback to "any prefix window" —
	// returning null lets resolveOpenTarget fall through to content-type/fileType.
	const w = m?.windows?.find((win) => win.opens && win.match.kind === 'prefix');
	return w ? mintWindowId(w, fileId) : null;
}

/**
 * The single document-open rule. The file's declared handler (`opensWith`) wins,
 * else the app registered for its content-type, else its coarser fileType, else
 * the file opens by its own id. No per-app appId switch — adding a handler is a
 * manifest `opens` declaration, never OS code. A recording made by 'recorder'
 * but tagged opensWith:'player' therefore opens in the system Player.
 */
export function resolveOpenTarget(file: FsFile): string {
	if (file.opensWith) {
		const id = handlerWindowId(file.opensWith, file.id);
		if (id) return id;
	}
	const contentType =
		file.bodyRef && 'contentType' in file.bodyRef ? file.bodyRef.contentType : undefined;
	if (contentType) {
		const opener = OPENERS_BY_CONTENT_TYPE.get(contentType);
		if (opener) return mintWindowId(opener.spec, file.id);
	}
	const byType = OPENERS_BY_FILETYPE.get(file.fileType);
	if (byType) return mintWindowId(byType.spec, file.id);
	return file.id;
}
