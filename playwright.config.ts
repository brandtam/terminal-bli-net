import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173
	},
	use: {
		permissions: ['camera'],
		launchOptions: {
			args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
		}
	},
	testDir: 'tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};

export default config;
