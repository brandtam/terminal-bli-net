/**
 * Touch input helpers for the desktop shell.
 *
 * Two gaps between mouse and touch drive this module:
 * - `dblclick` from a double tap is unreliable across mobile browsers, so on
 *   touch icons open classic-Mac style instead: first tap selects, second
 *   tap opens (see `isTouchLikePointer` and its callers).
 * - iOS Safari never fires `contextmenu` for a touch, so a long-press timer
 *   synthesizes the context-menu gesture where the browser won't.
 */

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/** True for pointer types where hover, right-click, and dblclick can't be assumed. */
export function isTouchLikePointer(pointerType: string): boolean {
	return pointerType === 'touch' || pointerType === 'pen';
}

export interface PressPoint {
	clientX: number;
	clientY: number;
}

interface PointerSample extends PressPoint {
	pointerType: string;
}

/**
 * The long-press state machine — DOM-free so it unit-tests in node.
 * `longPress` (below) wires it to an element.
 */
export function createLongPressMachine(onLongPress: (p: PressPoint) => void) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let origin: PressPoint | null = null;
	let suppressClick = false;

	function cancel(): void {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		origin = null;
	}

	return {
		down(e: PointerSample): void {
			suppressClick = false;
			cancel();
			if (!isTouchLikePointer(e.pointerType)) return;
			const at = { clientX: e.clientX, clientY: e.clientY };
			origin = at;
			timer = setTimeout(() => {
				timer = null;
				origin = null;
				suppressClick = true;
				onLongPress(at);
			}, LONG_PRESS_MS);
		},
		move(e: PressPoint): void {
			if (!origin) return;
			const dx = e.clientX - origin.clientX;
			const dy = e.clientY - origin.clientY;
			if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancel();
		},
		/** pointerup / pointercancel / native contextmenu / dragstart all land here. */
		cancel,
		/** One-shot: true exactly once for the click the browser fires after a fired long press. */
		consumeSuppressedClick(): boolean {
			const s = suppressClick;
			suppressClick = false;
			return s;
		}
	};
}

/**
 * Svelte action: long-press → context menu for touch pointers.
 *
 * The native `contextmenu` (Android fires it on long-press itself) and
 * `dragstart` (iPadOS starts a native drag from a touch hold) both cancel the
 * timer so the gesture never double-fires, and the click that trails a fired
 * long-press is swallowed in the capture phase so it can't bubble out and
 * immediately dismiss the menu it just opened.
 */
export function longPress(node: HTMLElement, onLongPress: (p: PressPoint) => void) {
	let handler = onLongPress;
	const machine = createLongPressMachine((p) => handler(p));

	const down = (e: PointerEvent) => machine.down(e);
	const move = (e: PointerEvent) => machine.move(e);
	const cancel = () => machine.cancel();
	const clickCapture = (e: MouseEvent) => {
		if (!machine.consumeSuppressedClick()) return;
		e.preventDefault();
		e.stopPropagation();
	};

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('contextmenu', cancel);
	node.addEventListener('dragstart', cancel);
	node.addEventListener('click', clickCapture, true);

	return {
		update(next: (p: PressPoint) => void) {
			handler = next;
		},
		destroy() {
			machine.cancel();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('contextmenu', cancel);
			node.removeEventListener('dragstart', cancel);
			node.removeEventListener('click', clickCapture, true);
		}
	};
}
