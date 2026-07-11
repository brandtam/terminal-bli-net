import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	saveTweaks,
	saveTimezone,
	loadTimezone,
	onPersistenceQuotaExceeded,
	resetQuotaReportingForTests
} from './persistence';

const TWEAKS = {
	wallpaper: 'teal',
	accent: '#f54e00',
	tvGridLoop: 400,
	marqueeLoop: 100,
	tvPauseOnHover: false
};

/** Minimal localStorage double whose setItem can be switched to quota-fail. */
function fakeLocalStorage(opts: { full: boolean }) {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			if (opts.full) {
				// A plain Error stands in for the browser's QuotaExceededError DOMException;
				// set() treats any setItem throw as a quota failure.
				throw new Error('QuotaExceededError');
			}
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		}
	};
}

describe('persistence quota-exceeded surfacing', () => {
	beforeEach(() => {
		resetQuotaReportingForTests();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		resetQuotaReportingForTests();
	});

	it('does not throw when localStorage is full', () => {
		vi.stubGlobal('localStorage', fakeLocalStorage({ full: true }));
		expect(() => saveTweaks(TWEAKS)).not.toThrow();
	});

	it('notifies the registered listener when a write hits quota', () => {
		vi.stubGlobal('localStorage', fakeLocalStorage({ full: true }));
		const listener = vi.fn();
		onPersistenceQuotaExceeded(listener);

		saveTweaks(TWEAKS);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('notifies only once per session, not on every failing write', () => {
		vi.stubGlobal('localStorage', fakeLocalStorage({ full: true }));
		const listener = vi.fn();
		onPersistenceQuotaExceeded(listener);

		saveTweaks(TWEAKS);
		saveTimezone('America/Denver');
		saveTweaks(TWEAKS);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('does not notify when writes succeed', () => {
		vi.stubGlobal('localStorage', fakeLocalStorage({ full: false }));
		const listener = vi.fn();
		onPersistenceQuotaExceeded(listener);

		saveTimezone('America/Denver');

		expect(listener).not.toHaveBeenCalled();
		expect(loadTimezone()).toBe('America/Denver');
	});

	it('does not burn the report on failures before a listener registers', () => {
		// A quota failure before the OS boots has no listener yet; the next
		// failure after registration must still surface the dialog.
		vi.stubGlobal('localStorage', fakeLocalStorage({ full: true }));
		saveTweaks(TWEAKS);

		const listener = vi.fn();
		onPersistenceQuotaExceeded(listener);
		saveTweaks(TWEAKS);
		saveTweaks(TWEAKS);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('reads still work while writes are failing', () => {
		const storage = fakeLocalStorage({ full: false });
		vi.stubGlobal('localStorage', storage);
		saveTimezone('America/Denver');

		vi.stubGlobal('localStorage', {
			...storage,
			setItem: () => {
				// A plain Error stands in for the browser's QuotaExceededError DOMException;
				// set() treats any setItem throw as a quota failure.
				throw new Error('QuotaExceededError');
			}
		});
		saveTimezone('Europe/Paris'); // lost, but must not crash
		expect(loadTimezone()).toBe('America/Denver');
	});
});
