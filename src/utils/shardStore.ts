const DB_NAME = 'p2p-shards';
const STORE_NAME = 'shards';
const META_STORE_NAME = 'transfers';
const DB_VERSION = 3;

interface StoredShard {
  key: string;
  transferId: string;
  shardId: number;
  data: ArrayBuffer;
  size: number;
}

export interface TransferMeta {
  transferId: string;
  downloadKey?: string;
  fileName: string;
  fileSize: number;
  shardSize: number;
  shardCount: number;
  updatedAt: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        const store = db.createObjectStore(META_STORE_NAME, { keyPath: 'transferId' });
        store.createIndex('downloadKey', 'downloadKey', { unique: false });
      } else {
        const store = request.transaction?.objectStore(META_STORE_NAME);
        if (store && !store.indexNames.contains('downloadKey')) {
          store.createIndex('downloadKey', 'downloadKey', { unique: false });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const makeKey = (transferId: string, shardId: number) => `${transferId}:${shardId}`;

export const putShard = async (transferId: string, shardId: number, data: ArrayBuffer) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredShard = {
      key: makeKey(transferId, shardId),
      transferId,
      shardId,
      data,
      size: data.byteLength
    };

    store.put(record);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
};

export const getShard = async (transferId: string, shardId: number): Promise<ArrayBuffer | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(makeKey(transferId, shardId));

    request.onsuccess = () => {
      const result = request.result as StoredShard | undefined;
      resolve(result?.data ?? null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getTransferMetaByDownloadKey = async (downloadKey: string): Promise<TransferMeta | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readonly');
    const store = tx.objectStore(META_STORE_NAME);
    const index = store.index('downloadKey');
    const request = index.get(downloadKey);
    request.onsuccess = () => resolve((request.result as TransferMeta | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteShard = async (transferId: string, shardId: number) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(makeKey(transferId, shardId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
};

export const putTransferMeta = async (
  meta: Omit<TransferMeta, 'updatedAt'> & { updatedAt?: number }
) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readwrite');
    const store = tx.objectStore(META_STORE_NAME);
    store.put({
      ...meta,
      updatedAt: meta.updatedAt ?? Date.now()
    } as TransferMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
};

export const getTransferMeta = async (transferId: string): Promise<TransferMeta | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readonly');
    const store = tx.objectStore(META_STORE_NAME);
    const request = store.get(transferId);
    request.onsuccess = () => resolve((request.result as TransferMeta | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteTransferMeta = async (transferId: string) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readwrite');
    const store = tx.objectStore(META_STORE_NAME);
    store.delete(transferId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const clearTransfer = async (transferId: string) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(META_STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        metaStore.delete(transferId);
        return;
      }

      const record = cursor.value as StoredShard;
      if (record.transferId === transferId) {
        cursor.delete();
      }
      cursor.continue();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};
