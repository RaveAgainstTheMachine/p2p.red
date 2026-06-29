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

const notifyShardDeleted = async (payload) => {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage(payload));
  } catch (error) {
    // noop
  }
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

const waitForShard = async (transferId, shardId, timeoutMs = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await getShard(transferId, shardId);
    if (data) return data;
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
    try {
      const meta = await waitForMeta(downloadKey);
      if (!meta) {
        await notifyShardDeleted({
          type: 'download_bridge_error',
          downloadKey,
          error: 'meta_not_found'
        });
        return new Response('Download metadata not found', { status: 404 });
      }

      const { transferId, fileName, fileSize, shardCount } = meta;
      const firstShard = await waitForShard(transferId, 0);
      if (!firstShard) {
        await notifyShardDeleted({
          type: 'download_bridge_error',
          transferId,
          downloadKey,
          error: 'first_shard_missing'
        });
        return new Response('Download shard not found', { status: 404 });
      }
      let nextShardId = 0;

      const stream = new ReadableStream({
        async pull(controller) {
          while (nextShardId < shardCount) {
            let data = await getShard(transferId, nextShardId);
            while (!data) {
              await new Promise((resolve) => setTimeout(resolve, 250));
              data = await getShard(transferId, nextShardId);
            }
            const buffer = new Uint8Array(data);
            for (let offset = 0; offset < buffer.byteLength; offset += STREAM_CHUNK_SIZE) {
              controller.enqueue(buffer.subarray(offset, offset + STREAM_CHUNK_SIZE));
            }
            await deleteShard(transferId, nextShardId);
            await notifyShardDeleted({
              type: 'download_bridge_shard_deleted',
              transferId,
              shardId: nextShardId,
              size: buffer.byteLength
            });
            nextShardId += 1;
            if (nextShardId >= shardCount) {
              controller.close();
              await notifyShardDeleted({
                type: 'download_bridge_complete',
                transferId,
                downloadKey
              });
            }
            return;
          }
          controller.close();
          await notifyShardDeleted({
            type: 'download_bridge_complete',
            transferId,
            downloadKey
          });
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
    } catch (error) {
      await notifyShardDeleted({
        type: 'download_bridge_error',
        transferId: downloadKey,
        downloadKey,
        error: error && error.message ? error.message : 'unknown'
      });
      return new Response('Download bridge failed', { status: 500 });
    }
  })());
});
