/**
 * The menu↔window bridge. `menus(os)` closures in the manifest can't reach a
 * component's state directly, so the window registers a handler set here on
 * mount and clears it on cleanup; the menu items call through the module. Same
 * pattern the other apps use for their menu bars.
 *
 * When no window is mounted (menu shown with the app closed, or mid-teardown)
 * the calls no-op — the handlers are null and the getters return safe blanks.
 */

export interface DialerHandlers {
	hangUp(): void;
	showPhonebook(): void;
	startSweep(): void;
	/** True while a call is up — the menu greys out Hang Up otherwise. */
	inCall(): boolean;
}

let handlers: DialerHandlers | null = null;

export const dialerBus = {
	register(next: DialerHandlers): void {
		handlers = next;
	},
	clear(next: DialerHandlers): void {
		// Only clear if we still own the slot — guards against a late cleanup
		// from a previous window stomping a freshly mounted one.
		if (handlers === next) handlers = null;
	},
	hangUp(): void {
		handlers?.hangUp();
	},
	showPhonebook(): void {
		handlers?.showPhonebook();
	},
	startSweep(): void {
		handlers?.startSweep();
	},
	inCall(): boolean {
		return handlers?.inCall() ?? false;
	}
};
