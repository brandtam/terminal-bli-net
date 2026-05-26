import type { FsResult, FsError, FsErrorCode } from './types';

export function fsErr(code: FsErrorCode, message: string, details?: unknown): FsError {
	return { code, message, details };
}

export function fail<T>(code: FsErrorCode, message: string, details?: unknown): FsResult<T> {
	return { ok: false, error: fsErr(code, message, details) };
}

export function ok<T>(value: T): FsResult<T> {
	return { ok: true, value };
}
