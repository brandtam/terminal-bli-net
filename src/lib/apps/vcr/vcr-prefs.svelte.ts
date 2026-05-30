import { appRead, appWrite } from '$lib/persistence';

export type VcrDevice = 'classic' | 'ag500r';

let device = $state<VcrDevice>(appRead<VcrDevice>('vcr', 'device', 'classic'));

export const vcrPrefs = {
	get device(): VcrDevice {
		return device;
	},
	setDevice(d: VcrDevice): void {
		device = d;
		appWrite('vcr', 'device', d);
	}
};
