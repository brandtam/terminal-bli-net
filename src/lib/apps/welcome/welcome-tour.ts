import type { AppContext } from '$lib/os/os-context';

export type WelcomeTourAction = 'computer-store' | 'software-shop';
export type WelcomeTourContext = {
	os: Pick<AppContext['os'], 'launchApp'>;
};

export function runWelcomeTourAction(ctx: WelcomeTourContext, action: WelcomeTourAction): void {
	if (action === 'computer-store') {
		ctx.os.launchApp('computer-store');
		return;
	}

	ctx.os.launchApp('software-shop');
}
