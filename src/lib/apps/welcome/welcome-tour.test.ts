import { describe, expect, it, vi } from 'vitest';
import { runWelcomeTourAction } from './welcome-tour';
import type { WelcomeTourContext } from './welcome-tour';

function makeCtx(): WelcomeTourContext {
	return {
		os: {
			launchApp: vi.fn()
		}
	};
}

describe('welcome tour actions', () => {
	it('opens the real Computer Store app through AppContext', () => {
		const ctx = makeCtx();

		runWelcomeTourAction(ctx, 'computer-store');

		expect(ctx.os.launchApp).toHaveBeenCalledWith('computer-store');
	});

	it('opens the real My Shelf app through AppContext', () => {
		const ctx = makeCtx();

		runWelcomeTourAction(ctx, 'software-shop');

		expect(ctx.os.launchApp).toHaveBeenCalledWith('software-shop');
	});
});
