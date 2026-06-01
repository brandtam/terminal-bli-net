import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { BodyGcReport, FsError } from '$lib/terminalos';
import BodyGcReportPanel from './BodyGcReportPanel.svelte';
import { bodyGcFailedBodyIds, bodyGcReportRows, bodyGcReportStatus } from './body-gc-report';

function renderPanel(props: {
	report?: BodyGcReport | null;
	error?: FsError | null;
	running?: boolean;
}): string {
	return render(BodyGcReportPanel, { props }).body;
}

describe('body GC report formatting', () => {
	it('maps every numeric BodyGcReport field to a display row', () => {
		const report: BodyGcReport = {
			stored: 7,
			reachable: 4,
			unreachable: 3,
			deleted: 2,
			failed: 1,
			failedBodyIds: ['body_failed']
		};

		expect(bodyGcReportRows(report)).toEqual([
			{ key: 'stored', label: 'stored', value: 7 },
			{ key: 'reachable', label: 'reachable', value: 4 },
			{ key: 'unreachable', label: 'unreachable', value: 3 },
			{ key: 'deleted', label: 'deleted', value: 2 },
			{ key: 'failed', label: 'failed', value: 1 }
		]);
		expect(bodyGcFailedBodyIds(report)).toEqual(['body_failed']);
	});

	it('summarizes success reports', () => {
		expect(
			bodyGcReportStatus({
				stored: 4,
				reachable: 4,
				unreachable: 0,
				deleted: 0,
				failed: 0,
				failedBodyIds: []
			})
		).toEqual({
			label: 'CLEAN',
			tone: 'ok',
			detail: 'No unreachable body records.'
		});
	});

	it('summarizes failed body deletions without treating the scan as missing', () => {
		expect(
			bodyGcReportStatus({
				stored: 4,
				reachable: 2,
				unreachable: 2,
				deleted: 1,
				failed: 1,
				failedBodyIds: ['body_failed']
			})
		).toEqual({
			label: 'NEEDS ATTENTION',
			tone: 'warn',
			detail: '1 body failed deletion.'
		});
	});
});

describe('BodyGcReportPanel rendering', () => {
	it('renders a successful report with every BodyGcReport field', () => {
		const html = renderPanel({
			report: {
				stored: 12,
				reachable: 10,
				unreachable: 2,
				deleted: 2,
				failed: 0,
				failedBodyIds: []
			}
		});

		expect(html).toContain('RECLAIMED');
		for (const label of ['stored', 'reachable', 'unreachable', 'deleted', 'failed']) {
			expect(html).toContain(label);
		}
		for (const value of ['12', '10', '2', '0']) {
			expect(html).toContain(value);
		}
		expect(html).toContain('failedBodyIds');
		expect(html).toContain('none');
	});

	it('renders failed delete details with failed body ids', () => {
		const html = renderPanel({
			report: {
				stored: 5,
				reachable: 2,
				unreachable: 3,
				deleted: 1,
				failed: 2,
				failedBodyIds: ['body_alpha', 'body_beta']
			}
		});

		expect(html).toContain('NEEDS ATTENTION');
		expect(html).toContain('failedBodyIds');
		expect(html).toContain('body_alpha');
		expect(html).toContain('body_beta');
	});

	it('renders collectGarbage errors separately from report failures', () => {
		const html = renderPanel({
			error: {
				code: 'corrupt_disk',
				message: 'Failed to list blob bodies for garbage collection'
			}
		});

		expect(html).toContain('SCAN FAILED');
		expect(html).toContain('corrupt_disk');
		expect(html).toContain('Failed to list blob bodies for garbage collection');
	});
});
