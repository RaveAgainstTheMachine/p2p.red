const DB_NAME = 'p2p-shards';
const STORE_NAME = 'shards';
const META_STORE_NAME = 'transfers';
const DB_VERSION = 3;
const STREAM_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

const openDb = () =>
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

const getTransferMetaByDownloadKey = async (downloadKey) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readonly');
    const store = tx.objectStore(META_STORE_NAME);
    const index = store.index('downloadKey');
    const request = index.get(downloadKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const getShard = async (transferId, shardId) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(`${transferId}:${shardId}`);
    request.onsuccess = () => resolve(request.result ? request.result.data : null);
    request.onerror = () => reject(request.error);
  });
};

const deleteShard = async (transferId, shardId) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(`${transferId}:${shardId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const waitForMeta = async (downloadKey, timeoutMs = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const meta = await getTransferMetaByDownloadKey(downloadKey);
    if (meta) return meta;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (data.type === 'ping') return;
  if (port && data.url) {
    port.postMessage({ debug: 'download_ready' });
    port.postMessage({ download: data.url });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/download-bridge/ping')) {
    event.respondWith(new Response(null, { status: 204 }));
    return;
  }

  const match = url.pathname.match(/\/download-bridge\/download\/(.+)$/);
  if (!match) return;

  const downloadKey = decodeURIComponent(match[1]);

  event.respondWith((async () => {
    const meta = await waitForMeta(downloadKey);
    if (!meta) {
      return new Response('Download metadata not found', { status: 404 });
    }

    const { transferId, fileName, fileSize, shardCount } = meta;
    let nextShardId = 0;

    const stream = new ReadableStream({
      async pull(controller) {
        while (nextShardId < shardCount) {
          const data = await getShard(transferId, nextShardId);
          if (!data) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            return;
          }
          const buffer = new Uint8Array(data);
          for (let offset = 0; offset < buffer.byteLength; offset += STREAM_CHUNK_SIZE) {
            controller.enqueue(buffer.subarray(offset, offset + STREAM_CHUNK_SIZE));
          }
          await deleteShard(transferId, nextShardId);
          nextShardId += 1;
          return;
        }
        controller.close();
      },
      cancel() {
        // noop
      }
    });

    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`
    });
    if (typeof fileSize === 'number') {
      headers.set('Content-Length', String(fileSize));
    }

    return new Response(stream, { headers });
  })());
});
