import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MANIFESTS } from './manifests';

/**
 * ADR 0008 guardrail: every directory under src/routes/api/ must be a manifest
 * app id or on this explicit OS-route allowlist. An app cannot squat an
 * unowned namespace, and a new OS route can only appear by editing the
 * allowlist here — deliberately, in a reviewed diff.
 */
const OS_ROUTE_ALLOWLIST = new Set(['chat', 'data', 'dev', 'subscribe']);

function apiRouteDirs(): string[] {
	const apiDir = fileURLToPath(new URL('../../../routes/api', import.meta.url));
	return readdirSync(apiDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

describe('api route ownership (docs/adr/0008)', () => {
	it('every src/routes/api/ directory is a manifest app id or an allowlisted OS route', () => {
		const appIds = new Set<string>(MANIFESTS.map((m) => m.id));
		const squatters = apiRouteDirs().filter(
			(dir) => !appIds.has(dir) && !OS_ROUTE_ALLOWLIST.has(dir)
		);
		expect(
			squatters,
			`unowned /api namespaces: ${squatters.join(', ')} — register the app in MANIFESTS or allowlist the OS route here`
		).toEqual([]);
	});

	it('the OS allowlist never overlaps a manifest app id', () => {
		// An overlap would make ownership ambiguous: is /api/<x> the OS's or the app's?
		const appIds = new Set<string>(MANIFESTS.map((m) => m.id));
		expect([...OS_ROUTE_ALLOWLIST].filter((route) => appIds.has(route))).toEqual([]);
	});
});
