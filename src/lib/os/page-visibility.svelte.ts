/**
 * A reactive mirror of `document.hidden`, started once by the OS
 * (OsApiClass.init) and read by every window's `lifecycle.hidden`. Apps use it
 * to pause loops when the tab goes to the background — the OS audio layer
 * suspends on the same event, so a paused app is also a silent one.
 */
class PageVisibility {
	hidden = $state(false);

	private handler: (() => void) | null = null;

	start(): void {
		if (typeof document === 'undefined' || this.handler) return;
		this.hidden = document.hidden;
		this.handler = () => {
			this.hidden = document.hidden;
		};
		document.addEventListener('visibilitychange', this.handler);
	}

	stop(): void {
		if (typeof document === 'undefined' || !this.handler) return;
		document.removeEventListener('visibilitychange', this.handler);
		this.handler = null;
	}
}

export const pageVisibility = new PageVisibility();
