import type { BodyEntry, BodyStore } from './storage-types';
import type { BodyId, FsResult } from '../types';
import { ok, fail } from '../errors';

const DB_NAME = 'terminalos';
const DB_VERSION = 2;
const STORE_NAME = 'bodies';
const STAGING_STORE_NAME = 'bodies_staging';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
			if (!db.objectStoreNames.contains(STAGING_STORE_NAME)) {
				db.createObjectStore(STAGING_STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function isQuotaError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'name' in error &&
		error.name === 'QuotaExceededError'
	);
}

function storageFailure(
	error: unknown,
	quotaMessage: string,
	fallbackMessage: string
): FsResult<void> {
	if (isQuotaError(error)) return fail('quota_exceeded', quotaMessage, error);
	return fail('corrupt_disk', fallbackMessage, error);
}

export class IndexedDBBodyStore implements BodyStore {
	private dbPromise: Promise<IDBDatabase> | null = null;
	private cachedBytes: number | null = null;

	private getDB(): Promise<IDBDatabase> {
		if (!this.dbPromise) {
			this.dbPromise = openDB();
		}
		return this.dbPromise;
	}

	async read(bodyId: BodyId): Promise<ArrayBuffer | null> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const request = store.get(bodyId);
			request.onsuccess = () => resolve(request.result ?? null);
			request.onerror = () => reject(request.error);
		});
	}

	async write(bodyId: BodyId, data: ArrayBuffer): Promise<FsResult<void>> {
		try {
			const db = await this.getDB();
			return new Promise((resolve) => {
				const tx = db.transaction(STORE_NAME, 'readwrite');
				const store = tx.objectStore(STORE_NAME);
				const getReq = store.get(bodyId);
				let oldSize = 0;
				getReq.onsuccess = () => {
					const buf = getReq.result;
					oldSize = buf instanceof ArrayBuffer ? buf.byteLength : 0;
					store.put(data, bodyId);
				};
				tx.oncomplete = () => {
					if (this.cachedBytes !== null) {
						this.cachedBytes += data.byteLength - oldSize;
					}
					resolve(ok(undefined));
				};
				tx.onerror = () => {
					resolve(
						storageFailure(
							tx.error,
							'IndexedDB storage quota exceeded',
							'Failed to write to IndexedDB'
						)
					);
				};
			});
		} catch (e) {
			return storageFailure(e, 'IndexedDB storage quota exceeded', 'Failed to write to IndexedDB');
		}
	}

	async delete(bodyId: BodyId): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			const getReq = store.get(bodyId);
			let oldSize = 0;
			getReq.onsuccess = () => {
				const buf = getReq.result;
				oldSize = buf instanceof ArrayBuffer ? buf.byteLength : 0;
				store.delete(bodyId);
			};
			tx.oncomplete = () => {
				if (this.cachedBytes !== null) {
					this.cachedBytes = Math.max(0, this.cachedBytes - oldSize);
				}
				resolve();
			};
			tx.onerror = () => reject(tx.error);
		});
	}

	async clear(): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction([STORE_NAME, STAGING_STORE_NAME], 'readwrite');
			tx.objectStore(STORE_NAME).clear();
			tx.objectStore(STAGING_STORE_NAME).clear();
			tx.oncomplete = () => {
				this.cachedBytes = 0;
				resolve();
			};
			tx.onerror = () => reject(tx.error);
		});
	}

	async replaceAll(entries: AsyncIterable<BodyEntry>): Promise<FsResult<void>> {
		let db: IDBDatabase;
		try {
			db = await this.getDB();
		} catch (e) {
			return storageFailure(e, 'IndexedDB storage quota exceeded', 'Failed to open IndexedDB');
		}

		const cleared = await this.clearStaging(db);
		if (!cleared.ok) return cleared;

		try {
			for await (const { bodyId, data } of entries) {
				const written = await this.writeStaging(db, bodyId, data);
				if (!written.ok) {
					await this.clearStagingQuietly(db);
					return written;
				}
			}
		} catch (e) {
			await this.clearStagingQuietly(db);
			throw e;
		}

		const swapped = await this.swapStagingIntoActive(db);
		if (!swapped.ok) {
			await this.clearStagingQuietly(db);
			return swapped;
		}

		this.cachedBytes = null;
		return ok(undefined);
	}

	private clearStaging(db: IDBDatabase): Promise<FsResult<void>> {
		return new Promise((resolve) => {
			const tx = db.transaction(STAGING_STORE_NAME, 'readwrite');
			tx.objectStore(STAGING_STORE_NAME).clear();
			tx.oncomplete = () => resolve(ok(undefined));
			tx.onerror = () =>
				resolve(
					storageFailure(
						tx.error,
						'IndexedDB storage quota exceeded',
						'Failed to clear IndexedDB body staging store'
					)
				);
		});
	}

	private async clearStagingQuietly(db: IDBDatabase): Promise<void> {
		try {
			await this.clearStaging(db);
		} catch {
			// The next replaceAll attempt clears staging before writing.
		}
	}

	private writeStaging(
		db: IDBDatabase,
		bodyId: BodyId,
		data: ArrayBuffer
	): Promise<FsResult<void>> {
		return new Promise((resolve) => {
			const tx = db.transaction(STAGING_STORE_NAME, 'readwrite');
			tx.objectStore(STAGING_STORE_NAME).put(data, bodyId);
			tx.oncomplete = () => resolve(ok(undefined));
			tx.onerror = () =>
				resolve(
					storageFailure(
						tx.error,
						'IndexedDB storage quota exceeded while staging backup bodies',
						'Failed to stage backup body in IndexedDB'
					)
				);
		});
	}

	private swapStagingIntoActive(db: IDBDatabase): Promise<FsResult<void>> {
		return new Promise((resolve) => {
			const tx = db.transaction([STORE_NAME, STAGING_STORE_NAME], 'readwrite');
			const active = tx.objectStore(STORE_NAME);
			const staging = tx.objectStore(STAGING_STORE_NAME);

			active.clear();
			const cursorRequest = staging.openCursor();
			cursorRequest.onsuccess = () => {
				const cursor = cursorRequest.result;
				if (!cursor) {
					staging.clear();
					return;
				}
				active.put(cursor.value, cursor.key);
				cursor.continue();
			};

			tx.oncomplete = () => resolve(ok(undefined));
			tx.onerror = () =>
				resolve(
					storageFailure(
						tx.error,
						'IndexedDB storage quota exceeded while replacing backup bodies',
						'Failed to replace IndexedDB bodies'
					)
				);
		});
	}

	async getUsedBytes(): Promise<number> {
		if (this.cachedBytes !== null) return this.cachedBytes;

		const db = await this.getDB();
		const total: number = await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const request = store.getAll();
			request.onsuccess = () => {
				const buffers = request.result as ArrayBuffer[];
				let sum = 0;
				for (const buf of buffers) {
					if (buf instanceof ArrayBuffer) sum += buf.byteLength;
				}
				resolve(sum);
			};
			request.onerror = () => reject(request.error);
		});
		this.cachedBytes = total;
		return total;
	}
}
