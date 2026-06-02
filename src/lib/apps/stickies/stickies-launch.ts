import type { AppLaunchHandler } from '$lib/terminalos/apps/app-manifest';
import { createStickyNote, setStickyColor } from './stickies-manager.svelte';

async function openNewSticky(ctx: Parameters<AppLaunchHandler>[0]): Promise<void> {
	const id = await createStickyNote(ctx.fs);
	const node = id ? ctx.fs.peekNode(id) : null;
	if (node?.kind === 'file') ctx.os.openDocument(node);
}

export const launchStickies: AppLaunchHandler = async (ctx, payload) => {
	if (payload?.action === 'color' && typeof payload.color === 'string') {
		if (ctx.os.activeId?.startsWith('sticky:')) {
			const noteId = ctx.os.activeId.replace('sticky:', '');
			await setStickyColor(ctx.fs, noteId, payload.color);
		}
		return;
	}

	await openNewSticky(ctx);
};
