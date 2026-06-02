import type { AppLaunchHandler } from '$lib/terminalos/apps/app-manifest';

export const launchChatrbot: AppLaunchHandler = (ctx, payload) => {
	if (typeof payload?.showId === 'string') {
		ctx.os.openChatByShowId(payload.showId);
		return;
	}

	ctx.os.startNewConversation();
};
