const DB_NAME = 'p2p-shards';
const STORE_NAME = 'shards';
const DB_VERSION = 1;

interface StoredShard {
  key: string;
  transferId: string;
  shardId: number;
  data: ArrayBuffer;
  size: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
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
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
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

export const deleteShard = async (transferId: string, shardId: number) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(makeKey(transferId, shardId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const clearTransfer = async (transferId: string) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
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
