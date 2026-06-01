import type { BodyGcReport, BodyId } from '$lib/terminalos';

export type BodyGcReportRow = {
	key: Exclude<keyof BodyGcReport, 'failedBodyIds'>;
	label: string;
	value: number;
};

export type BodyGcReportStatus = {
	label: string;
	tone: 'idle' | 'ok' | 'warn';
	detail: string;
};

const BODY_GC_ROWS: Array<{ key: BodyGcReportRow['key']; label: string }> = [
	{ key: 'stored', label: 'stored' },
	{ key: 'reachable', label: 'reachable' },
	{ key: 'unreachable', label: 'unreachable' },
	{ key: 'deleted', label: 'deleted' },
	{ key: 'failed', label: 'failed' }
];

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function bodyGcReportRows(report: BodyGcReport): BodyGcReportRow[] {
	return BODY_GC_ROWS.map(({ key, label }) => ({
		key,
		label,
		value: report[key]
	}));
}

export function bodyGcReportStatus(report: BodyGcReport): BodyGcReportStatus {
	if (report.failed > 0) {
		return {
			label: 'NEEDS ATTENTION',
			tone: 'warn',
			detail: `${pluralize(report.failed, 'body')} failed deletion.`
		};
	}

	if (report.deleted > 0) {
		return {
			label: 'RECLAIMED',
			tone: 'ok',
			detail: `${pluralize(report.deleted, 'body')} deleted.`
		};
	}

	return {
		label: 'CLEAN',
		tone: 'ok',
		detail: 'No unreachable body records.'
	};
}

export function bodyGcFailedBodyIds(report: BodyGcReport): BodyId[] {
	return [...report.failedBodyIds];
}
