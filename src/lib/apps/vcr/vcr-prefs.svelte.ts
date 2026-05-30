import { appRead, appWrite } from '$lib/persistence';

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
	}
};
