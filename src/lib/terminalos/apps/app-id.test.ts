import { describe, it, expect, expectTypeOf } from 'vitest';
import type { AppId, PersistedAppId } from '../filesystem/types';
import { MANIFESTS } from './manifests';
import { getAppDef } from './app-library';

/**
 * Guards the #28 win: AppId is a CLOSED union derived from the manifest ids, and
 * PersistedAppId stays OPEN at the disk boundary. The type-level assertions fail
 * to compile (a stronger signal than a failed runtime assertion) if either
 * property regresses.
 */
describe('AppId closed union', () => {
	it('makes a known id assignable to AppId, and the union stays closed', () => {
		// Compile-time: a real id is a member of the union. If MANIFESTS lost its
		// literal-id inference (e.g. defineApp stopped being generic, or MANIFESTS
		// got annotated back to TerminalAppManifest[]), AppId would widen to string.
		const known: AppId = 'finder';
		expect(MANIFESTS.some((m) => m.id === known)).toBe(true);

		// AppId must be a real union, NOT the wide `string` type:
		//  - a real id is a member of the union, and
		//  - `string` is NOT assignable to AppId (it would be, if AppId === string).
		expectTypeOf<'finder'>().toMatchTypeOf<AppId>();
		expectTypeOf<string>().not.toEqualTypeOf<AppId>();
	});

	it('treats an unknown disk id as a PersistedAppId, returning undefined', () => {
		// A renamed/removed app on an old disk must still load: getAppDef takes
		// PersistedAppId and resolves the miss to undefined rather than throwing
		// or failing to compile.
		const stale: PersistedAppId = 'not-an-app';
		expect(getAppDef(stale)).toBeUndefined();
	});

	it('resolves a known catalog id through getAppDef', () => {
		expect(getAppDef('finder')?.id).toBe('finder');
	});
});
