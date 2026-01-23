type InitMessage = {
  id: number;
  type: 'init';
  key: CryptoKey;
  ivBytes: number;
};

type EncryptMessage = {
  id: number;
  type: 'encrypt';
  shardId: number;
  attemptId: number;
  data: Uint8Array;
};

type DecryptMessage = {
  id: number;
  type: 'decrypt';
  shardId: number;
  attemptId: number;
  iv: Uint8Array;
  data: Uint8Array;
};

type CrcMessage = {
  id: number;
  type: 'crc32';
  crc: number;
  data: Uint8Array;
};

type IncomingMessage = InitMessage | EncryptMessage | DecryptMessage | CrcMessage;

type SuccessResponse = {
  id: number;
  ok: true;
  result: any;
};

type ErrorResponse = {
  id: number;
  ok: false;
  error: string;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc;
  }
  return table;
})();

const updateCRC32 = (crc: number, data: Uint8Array): number => {
  let next = crc;
  for (let i = 0; i < data.length; i++) {
    next = CRC32_TABLE[(next ^ data[i]) & 0xff] ^ (next >>> 8);
  }
  return next;
};

let aesKey: CryptoKey | null = null;
let ivBytes = 12;

const buildAad = (shardId: number, attemptId: number) => {
  const aad = new Uint8Array(8);
  const view = new DataView(aad.buffer);
  view.setUint32(0, shardId, true);
  view.setUint32(4, attemptId, true);
  return aad;
};

const postSuccess = (response: SuccessResponse, transfer?: Transferable[]) => {
  self.postMessage(response, transfer ?? []);
};

const postError = (id: number, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  self.postMessage({ id, ok: false, error: message } satisfies ErrorResponse);
};

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const payload = event.data;
  try {
    if (payload.type === 'init') {
      aesKey = payload.key;
      ivBytes = payload.ivBytes;
      postSuccess({ id: payload.id, ok: true, result: true });
      return;
    }

    if (payload.type === 'crc32') {
      const next = updateCRC32(payload.crc, payload.data);
      postSuccess({ id: payload.id, ok: true, result: { crc: next } });
      return;
    }

    if (!aesKey) {
      throw new Error('Crypto worker not initialized');
    }

    if (payload.type === 'encrypt') {
      const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: buildAad(payload.shardId, payload.attemptId) },
        aesKey,
        payload.data
      );
      const encryptedBytes = new Uint8Array(encrypted);
      postSuccess(
        {
          id: payload.id,
          ok: true,
          result: { iv, encrypted: encryptedBytes }
        },
        [iv.buffer, encryptedBytes.buffer]
      );
      return;
    }

    if (payload.type === 'decrypt') {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: payload.iv, additionalData: buildAad(payload.shardId, payload.attemptId) },
        aesKey,
        payload.data
      );
      const decryptedBytes = new Uint8Array(decrypted);
      postSuccess(
        {
          id: payload.id,
          ok: true,
          result: { decrypted: decryptedBytes }
        },
        [decryptedBytes.buffer]
      );
      return;
    }
  } catch (error) {
    postError(payload.id, error);
  }
};
