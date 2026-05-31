import { appRead, appWrite } from '$lib/persistence';
// Import from the leaf cache module, not window-host: manifests.ts imports this
// file at top level, and window-host transitively evaluates app-catalog's
// MANIFESTS-derived routes at load, so reaching window-host from here would be a
// load-order cycle. The leaf module has no runtime imports.
import { invalidateWindow } from '$lib/os/window-host-cache';

export type VcrDevice = 'generic' | 'ag500r';

// The Panasonic AG-500R is the default device.
let device = $state<VcrDevice>(appRead<VcrDevice>('vcr', 'device', 'ag500r'));

export const vcrPrefs = {
	get device(): VcrDevice {
		return device;
	},
	setDevice(d: VcrDevice): void {
		device = d;
		appWrite('vcr', 'device', d);
		// The vcr window's resolution (deck + size) is memoized by id and varies
		// by device, so drop the cached resolution — the next render re-runs the
		// device-aware title/size/component. Desktop's resize effect then refits
		// the open window. Without this the deck swap would serve the stale deck.
		invalidateWindow('vcr');
	}
};
