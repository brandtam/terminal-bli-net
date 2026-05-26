import type { BodyStore } from './storage-types';
import type { BodyId, FsResult } from '../types';
import { ok, fail } from '../errors';

const DB_NAME = 'terminalos';
const DB_VERSION = 1;
const STORE_NAME = 'bodies';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export class IndexedDBBodyStore implements BodyStore {
	private dbPromise: Promise<IDBDatabase> | null = null;

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
			return new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, 'readwrite');
				const store = tx.objectStore(STORE_NAME);
				const request = store.put(data, bodyId);
				request.onsuccess = () => resolve(ok(undefined));
				request.onerror = () => reject(request.error);
				tx.onerror = () => {
					if (tx.error?.name === 'QuotaExceededError') {
						resolve(fail('quota_exceeded', 'IndexedDB storage quota exceeded'));
					} else {
						reject(tx.error);
					}
				};
			});
		} catch (e) {
			return fail('quota_exceeded', 'Failed to write to IndexedDB', e);
		}
	}

	async delete(bodyId: BodyId): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			const request = store.delete(bodyId);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async clear(): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async getUsedBytes(): Promise<number> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const request = store.getAll();
			request.onsuccess = () => {
				const buffers = request.result as ArrayBuffer[];
				let total = 0;
				for (const buf of buffers) {
					if (buf instanceof ArrayBuffer) total += buf.byteLength;
				}
				resolve(total);
			};
			request.onerror = () => reject(request.error);
		});
	}
}
