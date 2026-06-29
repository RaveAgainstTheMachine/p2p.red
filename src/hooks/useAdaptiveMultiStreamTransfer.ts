import { useRef, useCallback, useState } from 'react';
import { DataConnection } from 'peerjs';
import { MultiStreamOrchestrator } from '../utils/multiStreamOrchestrator';
import { clearTransfer, deleteShard, getShard, putShard, putTransferMeta } from '../utils/shardStore';

interface AdaptiveTransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  activeStreams: number;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  adaptiveChunkSize: number;
  shardProgress?: Map<number, ShardState>; // Per-shard progress tracking
  rttMs?: number;
  candidateType?: string;
  receiverBackpressureLevel?: 'low' | 'high';
  cachedShardBytes?: number;
  maxCachedShardBytes?: number;
}

interface ReceiveOptions {
  fileHandle?: any;
  requireSave?: boolean;
  downloadKey?: string | null;
}

interface ReceiverDeviceProfile {
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
  isFirefox?: boolean;
  supportsDownloadBridge?: boolean;
  preferredStreamCount?: number;
  connection?: {
    effectiveType?: string;
    downlinkMbps?: number;
    rttMs?: number;
    saveData?: boolean;
  };
}

interface ShardState {
  id: number;
  offset: number;
  size: number;
  bytesTransferred: number;
  status: 'pending' | 'sending' | 'complete' | 'failed';
  channelId: number;
}

interface EncryptionState {
  enabled: boolean;
  key: CryptoKey;
  ivBytes: number;
  tagBytes: number;
}

interface ResumeSession {
  transferId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  lastModified?: number;
  shardSize: number;
  shardCount: number;
  completedShardIds: number[];
  updatedAt: number;
  status: 'in_progress' | 'complete';
}

const MAX_INDEXEDDB_CACHE_BYTES = 192 * 1024 * 1024;
const LOW_INDEXEDDB_CACHE_BYTES = 128 * 1024 * 1024;
const ECDH_IV_BYTES = 12;
const ECDH_TAG_BYTES = 16;
import { siteDomain } from '../config/environments';

const ECDH_INFO = new TextEncoder().encode(`${siteDomain}/webrtc-ecdh-v1`);

const RESUME_SESSION_KEY = 'p2p_resume_sessions_v1';

const loadResumeSessions = (): Record<string, ResumeSession> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ResumeSession>;
  } catch {
    return {};
  }
};

const saveResumeSessions = (sessions: Record<string, ResumeSession>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RESUME_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
};

const upsertResumeSession = (session: ResumeSession) => {
  const sessions = loadResumeSessions();
  sessions[session.transferId] = session;
  saveResumeSessions(sessions);
};

const removeResumeSession = (transferId: string) => {
  const sessions = loadResumeSessions();
  if (sessions[transferId]) {
    delete sessions[transferId];
    saveResumeSessions(sessions);
  }
};

const fingerprintFile = (file: File) => `${file.name}::${file.size}::${file.lastModified}`;

const findSenderResumeSession = (file: File): ResumeSession | null => {
  const sessions = loadResumeSessions();
  const fingerprint = fingerprintFile(file);
  const candidates = Object.values(sessions).filter(
    session => session.role === 'sender' && session.status === 'in_progress'
  );
  return candidates.find(session =>
    `${session.fileName}::${session.fileSize}::${session.lastModified ?? 0}` === fingerprint
  ) || null;
};

const supportsDownloadBridge = () => typeof window !== 'undefined' && 'serviceWorker' in navigator;

// Calculate optimal shard size based on network speed
function calculateShardSize(speed: number): number {
  const MB = 1024 * 1024;
  
  if (speed > 50 * MB) {        // > 400 Mbps
    return 100 * MB;             // 100MB shards
  } else if (speed > 10 * MB) { // > 80 Mbps
    return 50 * MB;              // 50MB shards
  } else if (speed > 2 * MB) {  // > 16 Mbps
    return 20 * MB;              // 20MB shards
  } else {                       // < 16 Mbps
    return 10 * MB;              // 10MB shards
  }
}

// Create shards from file size
function createShards(fileSize: number, shardSize: number): ShardState[] {
  const shards: ShardState[] = [];
  
  for (let offset = 0; offset < fileSize; offset += shardSize) {
    shards.push({
      id: shards.length,
      offset: offset,
      size: Math.min(shardSize, fileSize - offset),
      bytesTransferred: 0,
      status: 'pending',
      channelId: -1 // Will be assigned later
    });
  }
  
  return shards;
}

// CRC32 implementation for incremental hashing
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

function updateCRC32(crc: number, data: Uint8Array): number {
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc;
}

function finalizeCRC32(crc: number): string {
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

const toBase64 = (data: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(data)));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

const toArrayBuffer = (value: Uint8Array) =>
  new Uint8Array(value).buffer;

const createEcdhKeyPair = async () =>
  crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as Promise<CryptoKeyPair>;

const exportEcdhPublicKey = async (publicKey: CryptoKey) =>
  toBase64(await crypto.subtle.exportKey('raw', publicKey));

const importEcdhPublicKey = async (encoded: string) =>
  crypto.subtle.importKey(
    'raw',
    fromBase64(encoded),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

const hashSalt = async (value: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', toArrayBuffer(value)));

const deriveAesKey = async (
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  salt: Uint8Array
) => {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  );
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: ECDH_INFO
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const buildAad = (shardId: number, attemptId: number) => {
  const aad = new Uint8Array(8);
  const view = new DataView(aad.buffer);
  view.setUint32(0, shardId, true);
  view.setUint32(4, attemptId, true);
  return aad;
};

const encryptChunk = async (
  key: CryptoKey,
  shardId: number,
  attemptId: number,
  data: Uint8Array,
  ivBytes: number
) => {
  const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: buildAad(shardId, attemptId) },
    key,
    toArrayBuffer(data)
  );
  return { iv, encrypted: new Uint8Array(encrypted) };
};

const decryptChunk = async (
  key: CryptoKey,
  shardId: number,
  attemptId: number,
  iv: Uint8Array,
  data: Uint8Array
) => {
  const ivBuffer = new Uint8Array(iv);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer, additionalData: buildAad(shardId, attemptId) },
    key,
    toArrayBuffer(data)
  );
};

type CryptoWorkerClient = {
  init: (key: CryptoKey, ivBytes: number) => Promise<void>;
  encrypt: (shardId: number, attemptId: number, data: Uint8Array) => Promise<{ iv: Uint8Array; encrypted: Uint8Array }>;
  decrypt: (shardId: number, attemptId: number, iv: Uint8Array, data: Uint8Array) => Promise<{ decrypted: Uint8Array }>;
  crc32: (crc: number, data: Uint8Array) => Promise<number>;
  terminate: () => void;
};

const createCryptoWorkerClient = (): CryptoWorkerClient | null => {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('../workers/transferCryptoWorker.ts', import.meta.url), { type: 'module' });
  } catch (error) {
    console.warn('⚠️ Crypto worker unavailable', error);
    return null;
  }
  let requestId = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: any; error?: string }>) => {
    const payload = event.data;
    const entry = pending.get(payload.id);
    if (!entry) return;
    pending.delete(payload.id);
    if (payload.ok) {
      entry.resolve(payload.result);
    } else {
      entry.reject(new Error(payload.error || 'Crypto worker error'));
    }
  };

  const request = (type: string, data: Record<string, unknown>, transfer?: Transferable[]) =>
    new Promise<any>((resolve, reject) => {
      if (!worker) {
        reject(new Error('Crypto worker terminated'));
        return;
      }
      const id = requestId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, ...data }, transfer ?? []);
    });

  return {
    init: async (key, ivBytes) => {
      await request('init', { key, ivBytes });
    },
    encrypt: async (shardId, attemptId, data) => {
      const payload = data.slice();
      return request('encrypt', { shardId, attemptId, data: payload }, [payload.buffer]);
    },
    decrypt: async (shardId, attemptId, iv, data) =>
      request('decrypt', { shardId, attemptId, iv, data }, [iv.buffer, data.buffer]),
    crc32: async (crc, data) => {
      const result = await request('crc32', { crc, data });
      return result.crc as number;
    },
    terminate: () => {
      worker?.terminate();
      worker = null;
    }
  };
};

export const useAdaptiveMultiStreamTransfer = () => {
  const [transferProgressState, setTransferProgressState] = useState<AdaptiveTransferProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0,
    activeStreams: 0,
    networkQuality: 'good',
    adaptiveChunkSize: 256 * 1024, // Start with 256KB
    shardProgress: undefined
  });
  const transferProgress = useRef<AdaptiveTransferProgress>(transferProgressState);

  const isTransferring = useRef<boolean>(false);
  const startTime = useRef<number>(0);

  const setIsTransferring = useCallback((value: boolean) => {
    isTransferring.current = value;
  }, []);

  const setTransferProgress = useCallback((next: AdaptiveTransferProgress) => {
    transferProgress.current = next;
    setTransferProgressState(next);
  }, []);

  const isTransferDebugEnabled = () => {
    try {
      return typeof window !== 'undefined' && window.localStorage?.getItem('p2p_debug_transfer') === '1';
    } catch {
      return false;
    }
  };

  const debugLog = (...args: any[]) => {
    if (!isTransferDebugEnabled()) return;
    console.log(...args);
  };

  const isFirefoxBrowser = () => {
    try {
      return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
    } catch {
      return false;
    }
  };

  const shouldUseBlobDownload = (fileSize: number) => {
    if (!(Number.isFinite(fileSize) && fileSize > 0)) return false;

    const navAny = typeof navigator !== 'undefined' ? (navigator as any) : undefined;
    const deviceMemoryGB = navAny && typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : undefined;
    const isFirefox = isFirefoxBrowser();

    const mib = 1024 * 1024;
    const gib = 1024 * 1024 * 1024;

    const firefoxMax = 128 * mib;
    const fallbackMax = 256 * mib;

    if (isFirefox) return fileSize <= firefoxMax;

    if (typeof deviceMemoryGB === 'number' && deviceMemoryGB > 0) {
      const maxByMemory = Math.floor(deviceMemoryGB * 0.25 * gib);
      const cap = 512 * mib;
      const max = Math.max(64 * mib, Math.min(cap, maxByMemory));
      return fileSize <= max;
    }

    return fileSize <= fallbackMax;
  };

  const performEcdhHandshake = useCallback(async (
    conn: DataConnection,
    role: 'sender' | 'receiver',
    transferId?: string
  ): Promise<{ state: EncryptionState; transferId: string }> => {
    const timeoutMs = 10000;
    const encoder = new TextEncoder();

    if (role === 'sender' && !transferId) {
      throw new Error('Missing transferId for sender ECDH handshake');
    }

    return new Promise((resolve, reject) => {
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        conn.off('data', handler);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('ECDH handshake timed out'));
      }, timeoutMs);

      let localKeyPair: CryptoKeyPair | null = null;
      let localTransferId = transferId || '';

      const finishHandshake = async (peerPubKeyB64: string) => {
        if (!localKeyPair) {
          localKeyPair = await createEcdhKeyPair();
        }
        const peerPublicKey = await importEcdhPublicKey(peerPubKeyB64);
        const salt = await hashSalt(encoder.encode(localTransferId));
        const key = await deriveAesKey(localKeyPair.privateKey, peerPublicKey, salt);
        clearTimeout(timer);
        cleanup();
        resolve({
          state: {
            enabled: true,
            key,
            ivBytes: ECDH_IV_BYTES,
            tagBytes: ECDH_TAG_BYTES
          },
          transferId: localTransferId
        });
      };

      const handler = async (data: any) => {
        if (role === 'receiver' && data?.type === 'ecdh_init') {
          localTransferId = String(data.transferId || '');
          if (!localTransferId) {
            clearTimeout(timer);
            cleanup();
            reject(new Error('ECDH handshake missing transferId'));
            return;
          }
          localKeyPair = await createEcdhKeyPair();
          const pubKey = await exportEcdhPublicKey(localKeyPair.publicKey);
          conn.send({
            type: 'ecdh_reply',
            transferId: localTransferId,
            pubKey,
            ivBytes: ECDH_IV_BYTES,
            tagBytes: ECDH_TAG_BYTES
          });
          await finishHandshake(String(data.pubKey || ''));
        }

        if (role === 'sender' && data?.type === 'ecdh_reply') {
          if (!localTransferId || data.transferId !== localTransferId) return;
          await finishHandshake(String(data.pubKey || ''));
        }
      };


      conn.on('data', handler);

      if (role === 'sender') {
        (async () => {
          localKeyPair = await createEcdhKeyPair();
          const pubKey = await exportEcdhPublicKey(localKeyPair.publicKey);
          conn.send({
            type: 'ecdh_init',
            transferId: localTransferId,
            pubKey,
            ivBytes: ECDH_IV_BYTES,
            tagBytes: ECDH_TAG_BYTES,
            protocolVersion: 3
          });
        })().catch((error) => {
          clearTimeout(timer);
          cleanup();
          reject(error);
        });
      }
    });
  }, []);


  // Create multiple parallel DataChannels using orchestrator
  const createParallelChannels = useCallback(async (
    baseConn: DataConnection,
    streamCount: number,
    isSender: boolean
  ): Promise<RTCDataChannel[]> => {
    console.log(`🎯 Creating ${streamCount} parallel channels (${isSender ? 'SENDER' : 'RECEIVER'})`);

    try {
      const orchestrator = new MultiStreamOrchestrator(baseConn, isSender);
      const streamChannels = await orchestrator.initializeChannels(streamCount);
      
      const channels = streamChannels
        .filter(sc => sc.ready)
        .map(sc => sc.channel);

      console.log(`✅ Orchestrator: ${channels.length}/${streamCount} channels ready`);
      return channels;
    } catch (error) {
      console.error('❌ Orchestrator failed:', error);
      return [];
    }
  }, []);

  // Send any stream (File or ReadableStream) with shard-based parallel transfer
  const sendFileMultiStream = useCallback(async (
    conn: DataConnection,
    input: File | ReadableStream,
    fileName?: string,
    totalSize?: number
  ): Promise<void> => {
    console.log('🚀 sendFileMultiStream STARTED (SHARD-BASED)');
    return new Promise<void>(async (resolve, reject) => {
      setIsTransferring(true);
      startTime.current = Date.now();

      const isFile = input instanceof File;
      const fileSize = isFile ? input.size : (totalSize || 0);
      const name = fileName || (isFile ? input.name : 'download');

      const senderResumeSession = isFile ? findSenderResumeSession(input as File) : null;
      const transferId = senderResumeSession?.transferId || crypto.randomUUID();
      const senderCompletedShardIds = new Set<number>(senderResumeSession?.completedShardIds ?? []);
      let encryptionState: EncryptionState | null = null;
      const cryptoWorker = createCryptoWorkerClient();
      const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const perfStats = {
        encryptMs: 0,
        encryptBytes: 0,
        crcMs: 0,
        crcBytes: 0,
        bufferWaitMs: 0
      };
      const logPerf = (label: string) => {
        const crcPerMb = perfStats.crcBytes > 0 ? (perfStats.crcMs / (perfStats.crcBytes / (1024 * 1024))).toFixed(2) : '0';
        const encPerMb = perfStats.encryptBytes > 0 ? (perfStats.encryptMs / (perfStats.encryptBytes / (1024 * 1024))).toFixed(2) : '0';
        console.log(`⚙️ ${label} perf`, {
          encryptMs: Math.round(perfStats.encryptMs),
          encryptBytesMB: +(perfStats.encryptBytes / (1024 * 1024)).toFixed(1),
          encryptMsPerMB: encPerMb,
          crcMs: Math.round(perfStats.crcMs),
          crcBytesMB: +(perfStats.crcBytes / (1024 * 1024)).toFixed(1),
          crcMsPerMB: crcPerMb,
          bufferWaitMs: Math.round(perfStats.bufferWaitMs)
        });
      };

      try {
        const handshake = await performEcdhHandshake(conn, 'sender', transferId);
        encryptionState = handshake.state;
        if (encryptionState?.enabled && cryptoWorker) {
          try {
            await cryptoWorker.init(encryptionState.key, encryptionState.ivBytes);
          } catch (error) {
            console.warn('⚠️ Crypto worker init failed, falling back to main thread', error);
            cryptoWorker.terminate();
          }
        }
      } catch (error) {
        console.error('❌ ECDH handshake failed (sender):', error);
        setIsTransferring(false);
        cryptoWorker?.terminate();
        reject(error instanceof Error ? error : new Error('ECDH handshake failed'));
        return;
      }

      const perfInterval = setInterval(() => {
        logPerf('sender');
      }, 5000);

      const chunkHeaderBytes = encryptionState?.enabled
        ? 8 + encryptionState.ivBytes
        : 8;

      const buildChunkMessage = async (chunkData: Uint8Array, shardId: number, attemptId: number) => {
        if (encryptionState?.enabled) {
          const start = perfNow();
          const { iv, encrypted } = cryptoWorker
            ? await cryptoWorker.encrypt(shardId, attemptId, chunkData)
            : await encryptChunk(
                encryptionState.key,
                shardId,
                attemptId,
                chunkData,
                encryptionState.ivBytes
              );
          perfStats.encryptMs += perfNow() - start;
          perfStats.encryptBytes += chunkData.byteLength;
          const message = new Uint8Array(8 + encryptionState.ivBytes + encrypted.length);
          const view = new DataView(message.buffer);
          view.setUint32(0, shardId, true);
          view.setUint32(4, attemptId, true);
          message.set(iv, 8);
          message.set(encrypted, 8 + encryptionState.ivBytes);
          return message;
        }

        const message = new Uint8Array(8 + chunkData.length);
        const view = new DataView(message.buffer);
        view.setUint32(0, shardId, true);
        view.setUint32(4, attemptId, true);
        message.set(chunkData, 8);
        return message;
      };

      // Measure initial speed to determine shard size
      let estimatedSpeed = 50 * 1024 * 1024; // Default: 50 MB/s
      
      // Calculate shard size based on estimated speed
      let SHARD_SIZE = calculateShardSize(estimatedSpeed);
      console.log(`📊 Shard size: ${(SHARD_SIZE/1024/1024).toFixed(0)}MB (based on estimated ${(estimatedSpeed/1024/1024).toFixed(0)}MB/s)`);
      
      // Create shards
      const shards = createShards(fileSize, SHARD_SIZE);
      console.log(`🧩 Created ${shards.length} shards for ${(fileSize/1024/1024/1024).toFixed(2)}GB file`);
      
      // Adaptive channel count based on file size and network
      const MAX_CHANNELS = 64;
      const MIN_CHANNELS = 16;
      
      // Calculate optimal channels: more for larger files, fewer for smaller
      let numChannels = Math.min(
        Math.max(
          Math.ceil(shards.length / 8),
          MIN_CHANNELS
        ),
        MAX_CHANNELS,
        shards.length
      );
      
      // For very large files, use more channels
      if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
        numChannels = Math.min(
          MAX_CHANNELS,
          shards.length,
          Math.max(MIN_CHANNELS, Math.ceil(shards.length / 8))
        );
      }

      console.log(`🔧 Using ${numChannels} adaptive channels for ${shards.length} shards`);

      let networkQuality: AdaptiveTransferProgress['networkQuality'] = 'good';
      let rttMs: number | undefined;
      let candidateType: string | undefined;
      const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;

      const resumeInitialBytes = senderResumeSession
        ? senderResumeSession.completedShardIds.reduce((sum, id) => {
            const shard = shards[id];
            return shard ? sum + shard.size : sum;
          }, 0)
        : 0;

      setTransferProgress({
        bytesTransferred: resumeInitialBytes,
        totalBytes: fileSize,
        percentage: fileSize > 0 ? (resumeInitialBytes / fileSize) * 100 : 0,
        speed: 0,
        timeRemaining: 0,
        activeStreams: 0,
        networkQuality,
        adaptiveChunkSize: 0,
        rttMs,
        candidateType,
        receiverBackpressureLevel: 'low',
        cachedShardBytes: 0,
        maxCachedShardBytes: 0
      });
      const updateQualityFromStats = async () => {
        if (!pc || typeof pc.getStats !== 'function') return;
        const stats = await pc.getStats();
        let localCandidateType: string | undefined;
        let remoteCandidateType: string | undefined;
        let localCandidateId: string | undefined;
        let remoteCandidateId: string | undefined;

        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            if (typeof report.currentRoundTripTime === 'number') {
              rttMs = report.currentRoundTripTime * 1000;
            }
            localCandidateId = report.localCandidateId;
            remoteCandidateId = report.remoteCandidateId;
          }
        });

        if (localCandidateId || remoteCandidateId) {
          stats.forEach((report: any) => {
            if (localCandidateId && report.id === localCandidateId) {
              localCandidateType = report.candidateType;
            }
            if (remoteCandidateId && report.id === remoteCandidateId) {
              remoteCandidateType = report.candidateType;
            }
          });
        }

        if (typeof rttMs === 'number') {
          if (localCandidateType === 'host' && remoteCandidateType === 'host' && rttMs <= 5) {
            networkQuality = 'excellent';
          } else if (rttMs <= 30) {
            networkQuality = 'good';
          } else if (rttMs <= 120) {
            networkQuality = 'fair';
          } else {
            networkQuality = 'poor';
          }
        } else {
          networkQuality = pc.connectionState === 'connected' ? 'good' : 'poor';
        }

        if (localCandidateType && remoteCandidateType) {
          candidateType = `${localCandidateType}/${remoteCandidateType}`;
        } else if (localCandidateType || remoteCandidateType) {
          candidateType = localCandidateType || remoteCandidateType;
        }
      };
      const qualityInterval = setInterval(() => {
        void updateQualityFromStats();
      }, 1000);

      let receiverBackpressureLevel: string = 'low';
      const receiverBackpressureHandler = (data: any) => {
        if (data?.type === 'receiver_backpressure' && (data.level === 'low' || data.level === 'high')) {
          receiverBackpressureLevel = data.level;
        }
      };
      conn.on('data', receiverBackpressureHandler);

      try {
        // Send metadata first
        console.log('📤 Sending shard metadata...');
        const metadata = {
          type: 'multi_stream_start',
          fileName: name,
          fileSize,
          streamCount: numChannels,
          shardSize: SHARD_SIZE,
          shardCount: shards.length,
          protocolVersion: 3,
          chunkHeaderBytes,
          transferId,
          lastModified: isFile ? (input as File).lastModified : undefined,
          encryption: {
            enabled: true,
            ivBytes: encryptionState?.ivBytes ?? ECDH_IV_BYTES,
            tagBytes: encryptionState?.tagBytes ?? ECDH_TAG_BYTES
          }
        };
        conn.send(metadata);

        upsertResumeSession({
          transferId,
          role: 'sender',
          fileName: name,
          fileSize,
          lastModified: isFile ? (input as File).lastModified : undefined,
          shardSize: SHARD_SIZE,
          shardCount: shards.length,
          completedShardIds: Array.from(senderCompletedShardIds),
          updatedAt: Date.now(),
          status: 'in_progress'
        });

        let receiverProfile: ReceiverDeviceProfile | undefined;
        await new Promise<void>((resolveReady) => {
          const readyHandler = (data: any) => {
            if (data?.type === 'receiver_ready') {
              if (data.receiverProfile && typeof data.receiverProfile === 'object') {
                receiverProfile = data.receiverProfile as ReceiverDeviceProfile;
              }
              conn.off('data', readyHandler);
              resolveReady();
            }
          };
          conn.on('data', readyHandler);
        });

        const waitForResumeState = () => new Promise<void>((resolveResume) => {
          const resumeHandler = (data: any) => {
            if (data?.type === 'resume_state' && data.transferId === transferId) {
              if (Array.isArray(data.completedShardIds)) {
                senderCompletedShardIds.clear();
                data.completedShardIds.forEach((id: number) => senderCompletedShardIds.add(id));
              }
              conn.off('data', resumeHandler);
              resolveResume();
            }
          };
          conn.on('data', resumeHandler);
          setTimeout(() => {
            conn.off('data', resumeHandler);
            resolveResume();
          }, 2000);
        });

        await waitForResumeState();

        await updateQualityFromStats();

        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
        let adjustedChannels = numChannels;

        const qualityMax = (() => {
          const q = networkQuality as AdaptiveTransferProgress['networkQuality'];
          if (q === 'excellent') return 64;
          if (q === 'good') return 48;
          if (q === 'fair') return 24;
          return 12;
        })();

        let deviceMax = 64;
        const cores = receiverProfile?.hardwareConcurrency ?? (navigator as any).hardwareConcurrency;
        const mem = receiverProfile?.deviceMemoryGB;
        if (typeof cores === 'number') {
          if (cores <= 2) deviceMax = Math.min(deviceMax, 8);
          else if (cores <= 4) deviceMax = Math.min(deviceMax, 16);
          else if (cores <= 6) deviceMax = Math.min(deviceMax, 24);
        }
        if (typeof mem === 'number') {
          if (mem <= 2) deviceMax = Math.min(deviceMax, 8);
          else if (mem <= 4) deviceMax = Math.min(deviceMax, 16);
          else if (mem <= 8) deviceMax = Math.min(deviceMax, 24);
        }

        const eff = receiverProfile?.connection?.effectiveType;
        const saveData = receiverProfile?.connection?.saveData;
        if (saveData) deviceMax = Math.min(deviceMax, 12);
        if (eff === 'slow-2g') deviceMax = Math.min(deviceMax, 8);
        if (eff === '2g') deviceMax = Math.min(deviceMax, 10);
        if (eff === '3g') deviceMax = Math.min(deviceMax, 16);

        if (!isFile && typeof receiverProfile?.preferredStreamCount === 'number') {
          adjustedChannels = receiverProfile.preferredStreamCount;
        } else if (!isFile && receiverProfile?.isFirefox) {
          adjustedChannels = 1;
        } else {
          adjustedChannels = clamp(adjustedChannels, 4, Math.min(qualityMax, deviceMax, MAX_CHANNELS, shards.length));
        }

        if (adjustedChannels !== numChannels) {
          conn.send({
            type: 'stream_count_update',
            streamCount: adjustedChannels,
            timestamp: Date.now()
          });
          console.log('📡 Sent stream_count_update', {
            requested: adjustedChannels,
            original: numChannels,
            transferId
          });
        }

        // Create parallel channels
        console.log('🔧 Creating DataChannels...');
        const channels = await createParallelChannels(conn, adjustedChannels, true);
        
        if (channels.length === 0) {
          throw new Error('Failed to create any parallel channels');
        }

        const CHANNEL_BUFFER_HIGH_WATERMARK = 16 * 1024 * 1024;
        const CHANNEL_BUFFER_LOW_WATERMARK = 8 * 1024 * 1024;
        for (const ch of channels) {
          try {
            ch.bufferedAmountLowThreshold = CHANNEL_BUFFER_LOW_WATERMARK;
          } catch {
            // ignore
          }
        }

        const waitForChannelBufferRoom = async (channel: RTCDataChannel) => {
          while (channel.bufferedAmount > CHANNEL_BUFFER_HIGH_WATERMARK) {
            const waitStart = perfNow();
            await new Promise<void>((resolve) => {
              let done = false;
              const onLow = () => {
                if (done) return;
                done = true;
                channel.removeEventListener('bufferedamountlow', onLow);
                resolve();
              };
              channel.addEventListener('bufferedamountlow', onLow);
              setTimeout(() => {
                if (done) return;
                done = true;
                channel.removeEventListener('bufferedamountlow', onLow);
                resolve();
              }, 50);
            });
            perfStats.bufferWaitMs += perfNow() - waitStart;
            if (localStorage.p2p_debug_transfer === '1') {
              console.log(`🕰️ Waited ${perfNow() - waitStart}ms for channel ${channel.label} to drain`);
            }
          }
        };

        conn.send({
          type: 'stream_count_update',
          streamCount: channels.length,
          timestamp: Date.now()
        });

        let totalBytesTransferred = resumeInitialBytes;
        let totalCrc32 = 0xFFFFFFFF;
        const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
        const BASE_CHUNK_SIZE = isFirefox ? 16 * 1024 : 64 * 1024;
        const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;
        const sctpMax = pc?.sctp?.maxMessageSize;
        const encryptionOverhead = chunkHeaderBytes + (encryptionState?.enabled ? encryptionState.tagBytes : 0);
        const sctpLimit =
          typeof sctpMax === 'number' && sctpMax > 0
            ? Math.max(16 * 1024, sctpMax - encryptionOverhead)
            : BASE_CHUNK_SIZE;
        const CHUNK_SIZE = Math.min(BASE_CHUNK_SIZE, sctpLimit);
        if (typeof sctpMax === 'number' && sctpMax > 0) {
          console.log(`📦 Chunk size: ${(CHUNK_SIZE / 1024).toFixed(0)}KB (SCTP max ${(sctpMax / 1024).toFixed(0)}KB, overhead ${encryptionOverhead} bytes)`);
        }
        let lastLoggedPercentage = 0;
        let lastUiProgressUpdateTs = 0;
        const UI_PROGRESS_UPDATE_INTERVAL_MS = 250;

        debugLog('🧪 transfer sender start', {
          fileSize,
          shardCount: shards.length,
          shardSize: SHARD_SIZE,
          channels: adjustedChannels,
          CHUNK_SIZE
        });

        // Cache for ReadableStream shards (enables retransmission)
        const shardCache = new Map<number, Uint8Array>();
        const shardAttemptIds = new Map<number, number>();

        let cachedShardBytes = 0;
        const MAX_CACHED_SHARD_BYTES = 512 * 1024 * 1024;
        const cacheWaiters: Array<() => void> = [];
        const waitForCacheRoom = async (needBytes: number) => {
          while (cachedShardBytes + needBytes > MAX_CACHED_SHARD_BYTES) {
            await new Promise<void>(resolveWait => cacheWaiters.push(resolveWait));
          }
        };
        const notifyCacheWaiters = () => {
          while (cacheWaiters.length > 0) {
            const resolveWait = cacheWaiters.shift();
            if (resolveWait) resolveWait();
          }
        };

        const updateTotalCrc = (chunk: Uint8Array) => {
          const start = perfNow();
          if (cryptoWorker) {
            return cryptoWorker.crc32(totalCrc32, chunk).then((next) => {
              totalCrc32 = next;
              perfStats.crcMs += perfNow() - start;
              perfStats.crcBytes += chunk.byteLength;
            });
          }
          totalCrc32 = updateCRC32(totalCrc32, chunk);
          perfStats.crcMs += perfNow() - start;
          perfStats.crcBytes += chunk.byteLength;
          return Promise.resolve();
        };

        const computeShardCrc = async (chunk: Uint8Array) => {
          const start = perfNow();
          let crc = 0xFFFFFFFF;
          if (cryptoWorker) {
            crc = await cryptoWorker.crc32(crc, chunk);
          } else {
            crc = updateCRC32(crc, chunk);
          }
          perfStats.crcMs += perfNow() - start;
          perfStats.crcBytes += chunk.byteLength;
          return finalizeCRC32(crc);
        };

        // Handle shard confirmations and retransmission requests (must be active during transfer
        // so ReadableStream cache can drain and not stall at MAX_CACHED_SHARD_BYTES)
        const messageHandler = async (data: any) => {
          if (data.type === 'shard_confirmed') {
            // Receiver confirmed shard is good, clear from cache
            const shardId = data.shardId;
            if (shardCache.has(shardId)) {
              const cached = shardCache.get(shardId);
              shardCache.delete(shardId);
              if (cached) {
                cachedShardBytes = Math.max(0, cachedShardBytes - cached.length);
              }
              notifyCacheWaiters();
              console.log(`✅ Shard ${shardId} confirmed, cleared from cache (${shardCache.size} shards cached)`);
            }
            if (!senderCompletedShardIds.has(shardId)) {
              senderCompletedShardIds.add(shardId);
              upsertResumeSession({
                transferId,
                role: 'sender',
                fileName: name,
                fileSize,
                lastModified: isFile ? (input as File).lastModified : undefined,
                shardSize: SHARD_SIZE,
                shardCount: shards.length,
                completedShardIds: Array.from(senderCompletedShardIds),
                updatedAt: Date.now(),
                status: 'in_progress'
              });
            }
          } else if (data.type === 'request_shard_meta') {
            if (!Array.isArray(data.shardIds)) return;
            for (const shardId of data.shardIds) {
              const shard = shards[shardId];
              if (!shard) continue;

              let shardData: Uint8Array;
              if (isFile) {
                const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
                shardData = new Uint8Array(await shardBlob.arrayBuffer());
              } else {
                const cached = shardCache.get(shardId);
                if (!cached) {
                  console.error(`❌ Shard ${shardId} not in cache, cannot resend metadata`);
                  continue;
                }
                shardData = cached;
              }

              const attemptId = shardAttemptIds.get(shard.id) ?? 0;
              const shardCRC = await computeShardCrc(shardData);

              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shardData.length,
                channelId: shard.channelId,
                attemptId,
                crc32: shardCRC
              });
            }
          } else if (data.type === 'retransmit_shards') {
            console.log(`📡 Retransmit request for ${data.shardIds.length} shards`);

            for (const shardId of data.shardIds) {
              const shard = shards[shardId];
              if (!shard) continue;
              const channel = channels[shard.channelId];

              if (channel.readyState !== 'open') {
                console.error(`❌ Channel ${shard.channelId} closed, cannot retransmit shard ${shardId}`);
                continue;
              }

              console.log(`🔄 Retransmitting shard ${shardId} (${(shard.size/1024/1024).toFixed(1)}MB)`);

              // Get shard data from File or cache
              let shardData: Uint8Array;
              if (isFile) {
                const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
                shardData = new Uint8Array(await shardBlob.arrayBuffer());
              } else {
                const cached = shardCache.get(shardId);
                if (!cached) {
                  console.error(`❌ Shard ${shardId} not in cache, cannot retransmit`);
                  continue;
                }
                shardData = cached;
              }

              const attemptId = (shardAttemptIds.get(shard.id) ?? 0) + 1;
              shardAttemptIds.set(shard.id, attemptId);

              // Calculate per-shard CRC32 (needed so receiver can verify retransmits)
              const shardCRC = await computeShardCrc(shardData);

              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shardData.length,
                channelId: shard.channelId,
                attemptId,
                crc32: shardCRC
              });

              let sentBytes = 0;
              while (sentBytes < shardData.length) {
                const chunkData = shardData.subarray(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));

                while (receiverBackpressureLevel === 'high') {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }

                await waitForChannelBufferRoom(channel);

                const message = await buildChunkMessage(chunkData, shard.id, attemptId);
                channel.send(message.buffer);
                sentBytes += chunkData.length;
              }
            }

            conn.send({
              type: 'retransmit_complete',
              timestamp: Date.now()
            });
          }
        };

        conn.on('data', messageHandler);

        // For Files: Precompute total CRC32 in deterministic order
        if (isFile) {
          const computeTotalCrcForFile = async () => {
            let crc = 0xFFFFFFFF;
            for (const shard of shards) {
              const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
              const shardData = new Uint8Array(await shardBlob.arrayBuffer());
              const start = perfNow();
              if (cryptoWorker) {
                crc = await cryptoWorker.crc32(crc, shardData);
              } else {
                crc = updateCRC32(crc, shardData);
              }
              perfStats.crcMs += perfNow() - start;
              perfStats.crcBytes += shardData.byteLength;
            }
            return crc;
          };
          totalCrc32 = await computeTotalCrcForFile();
        }

        // For Files: Use parallel shard sending
        if (isFile) {
          // Assign shards to channels (round-robin)
          shards.forEach((shard, i) => {
            shard.channelId = i % channels.length;
            shardAttemptIds.set(shard.id, 0);
          });

          console.log(`📊 Shard distribution: ${channels.length} channels handling ${shards.length} shards`);

          const sendPromises = channels.map(async (channel, channelId) => {
            const assignedShards = shards.filter(s => s.channelId === channelId);

            for (const shard of assignedShards) {
              if (senderCompletedShardIds.has(shard.id)) {
                continue;
              }
              shard.status = 'sending';
              
              const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
              const shardData = new Uint8Array(await shardBlob.arrayBuffer());

              const attemptId = shardAttemptIds.get(shard.id) ?? 0;
              
              // Calculate per-shard CRC32
              const shardCRC = await computeShardCrc(shardData);
              
              // Send shard metadata with CRC32
              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shard.size,
                channelId: channelId,
                attemptId,
                crc32: shardCRC
              });

              // Send shard in chunks
              let sentBytes = 0;
              while (sentBytes < shardData.length) {
                const chunkData = shardData.subarray(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));

                while (receiverBackpressureLevel === 'high') {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                // Wait if buffer is full
                await waitForChannelBufferRoom(channel);
                
                // Send chunk with shard ID
                const message = await buildChunkMessage(chunkData, shard.id, attemptId);
                channel.send(message.buffer);
                sentBytes += chunkData.length;
                shard.bytesTransferred += chunkData.length;
                totalBytesTransferred += chunkData.length;
                
                // Update progress
                const now = Date.now();
                const elapsed = (now - startTime.current) / 1000;
                const speed = elapsed > 0 ? totalBytesTransferred / elapsed : 0;
                const currentPercentage = Math.floor((totalBytesTransferred / fileSize) * 100);
                
                // Log every 10% milestone
                if (currentPercentage >= lastLoggedPercentage + 10) {
                  console.log(`📤 ${currentPercentage}% sent (${(totalBytesTransferred/1024/1024/1024).toFixed(2)}GB / ${(fileSize/1024/1024/1024).toFixed(2)}GB) @ ${(speed/1024/1024).toFixed(1)}MB/s`);
                  lastLoggedPercentage = currentPercentage;
                }

                if (now - lastUiProgressUpdateTs >= UI_PROGRESS_UPDATE_INTERVAL_MS || currentPercentage >= 100) {
                  lastUiProgressUpdateTs = now;
                  setTransferProgress({
                    bytesTransferred: totalBytesTransferred,
                    totalBytes: fileSize,
                    percentage: (totalBytesTransferred / fileSize) * 100,
                    speed,
                    timeRemaining: speed > 0 ? (fileSize - totalBytesTransferred) / speed : 0,
                    activeStreams: channels.length,
                    networkQuality,
                    adaptiveChunkSize: CHUNK_SIZE,
                    rttMs,
                    candidateType,
                    receiverBackpressureLevel: receiverBackpressureLevel === 'high' ? 'high' : 'low',
                    cachedShardBytes,
                    maxCachedShardBytes: MAX_CACHED_SHARD_BYTES
                  });
                }
              }
              
              shard.status = 'complete';
            }
          });

          // Wait for all channels to finish
          await Promise.all(sendPromises);
        } else {
          // For ReadableStreams: Sequential shard filling and sending
          console.log('📦 ReadableStream mode - sequential shard processing');
          
          const reader = input.getReader();
          let currentShardIndex = 0;
          let currentShardBuffer = new Uint8Array(SHARD_SIZE);
          let currentShardFilled = 0;
          
          // Assign shards to channels for when they're ready
          shards.forEach((shard, i) => {
            shard.channelId = i % channels.length;
            shardAttemptIds.set(shard.id, 0);
          });

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;

            if (value) {
              await updateTotalCrc(value);
            }
            
            if (value) {
              let valueOffset = 0;
              
              // Fill current shard(s) with this chunk
              while (valueOffset < value.length) {
                if (currentShardIndex >= shards.length) {
                  currentShardIndex = Math.max(0, shards.length - 1);
                }

                const shard = shards[currentShardIndex];
                if (!shard) {
                  break;
                }

                if (currentShardIndex === shards.length - 1 && currentShardFilled >= shard.size) {
                  shard.size += Math.max(SHARD_SIZE, value.length - valueOffset);
                  if (currentShardBuffer.length < shard.size) {
                    const next = new Uint8Array(shard.size);
                    next.set(currentShardBuffer.subarray(0, currentShardFilled), 0);
                    currentShardBuffer = next;
                  }
                }

                const spaceLeft = shard.size - currentShardFilled;
                const bytesToCopy = Math.min(spaceLeft, value.length - valueOffset);
                
                // Copy data into current shard buffer
                currentShardBuffer.set(
                  value.subarray(valueOffset, valueOffset + bytesToCopy),
                  currentShardFilled
                );
                
                currentShardFilled += bytesToCopy;
                valueOffset += bytesToCopy;
                
                // Shard complete? Send it! (never auto-send the last shard; it may grow until done)
                if (currentShardIndex < shards.length - 1 && currentShardFilled >= shard.size) {
                  const shardData = currentShardBuffer.slice(0, currentShardFilled);
                  
                  // Cache shard until confirmed by receiver
                  await waitForCacheRoom(shardData.length);
                  shardCache.set(shard.id, shardData);
                  cachedShardBytes += shardData.length;
                  
                  // Calculate per-shard CRC32
                  const shardCRC = await computeShardCrc(shardData);

                  const attemptId = shardAttemptIds.get(shard.id) ?? 0;
                  
                  // Send shard
                  const channel = channels[shard.channelId];
                  
                  conn.send({
                    type: 'shard_start',
                    shardId: shard.id,
                    offset: shard.offset,
                    size: shardData.length,
                    channelId: shard.channelId,
                    attemptId,
                    crc32: shardCRC
                  });
                  
                  // Send in chunks
                  let sentBytes = 0;
                  while (sentBytes < shardData.length) {
                    const chunkData = shardData.subarray(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));

                    while (receiverBackpressureLevel === 'high') {
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }

                    await waitForChannelBufferRoom(channel);
                    
                    const message = await buildChunkMessage(chunkData, shard.id, attemptId);
                    channel.send(message.buffer);
                    sentBytes += chunkData.length;
                  }
                  
                  totalBytesTransferred += shardData.length;
                  shard.status = 'complete';
                  
                  // Update progress
                  const now = Date.now();
                  const elapsed = (now - startTime.current) / 1000;
                  const speed = elapsed > 0 ? totalBytesTransferred / elapsed : 0;
                  const currentPercentage = Math.floor(Math.min(1, totalBytesTransferred / fileSize) * 100);
                  
                  if (currentPercentage >= lastLoggedPercentage + 10) {
                    console.log(`📤 ${currentPercentage}% sent (${(totalBytesTransferred/1024/1024/1024).toFixed(2)}GB / ${(fileSize/1024/1024/1024).toFixed(2)}GB) @ ${(speed/1024/1024).toFixed(1)}MB/s`);
                    lastLoggedPercentage = currentPercentage;
                  }

                  if (now - lastUiProgressUpdateTs >= UI_PROGRESS_UPDATE_INTERVAL_MS || currentPercentage >= 100) {
                    lastUiProgressUpdateTs = now;
                    setTransferProgress({
                      bytesTransferred: totalBytesTransferred,
                      totalBytes: fileSize,
                      percentage: (totalBytesTransferred / fileSize) * 100,
                      speed,
                      timeRemaining: speed > 0 ? (fileSize - totalBytesTransferred) / speed : 0,
                      activeStreams: channels.length,
                      networkQuality,
                      adaptiveChunkSize: CHUNK_SIZE,
                      rttMs,
                      candidateType,
                      receiverBackpressureLevel: receiverBackpressureLevel === 'high' ? 'high' : 'low',
                      cachedShardBytes,
                      maxCachedShardBytes: MAX_CACHED_SHARD_BYTES
                    });
                  }
                  
                  // Move to next shard
                  currentShardIndex++;
                  if (currentShardIndex < shards.length) {
                    currentShardBuffer = new Uint8Array(SHARD_SIZE);
                    currentShardFilled = 0;
                  }
                }
              }
            }
          }

          // Send final partial shard if any (only if we haven't already sent all shards)
          if (currentShardFilled > 0 && currentShardIndex < shards.length) {
            const shard = shards[currentShardIndex];
            if (!shard) {
              console.log('✅ All shards sent, stream complete');
            } else if (senderCompletedShardIds.has(shard.id)) {
              currentShardIndex += 1;
            } else {
              const shardData = currentShardBuffer.slice(0, currentShardFilled);

              // Cache final shard until confirmed
              await waitForCacheRoom(shardData.length);
              shardCache.set(shard.id, shardData);
              cachedShardBytes += shardData.length;

              // Calculate per-shard CRC32
              const shardCRC = await computeShardCrc(shardData);

              const attemptId = shardAttemptIds.get(shard.id) ?? 0;

              const channel = channels[shard.channelId];

              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shardData.length,
                channelId: shard.channelId,
                attemptId,
                crc32: shardCRC
              });

              let sentBytes = 0;
              while (sentBytes < shardData.length) {
                while (receiverBackpressureLevel === 'high') {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }

                await waitForChannelBufferRoom(channel);

                const chunkData = shardData.subarray(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));

                const message = await buildChunkMessage(chunkData, shard.id, attemptId);
                channel.send(message.buffer);
                sentBytes += chunkData.length;
              }

              totalBytesTransferred += shardData.length;
              shard.status = 'complete';

              const now = Date.now();
              const elapsed = (now - startTime.current) / 1000;
              const speed = elapsed > 0 ? totalBytesTransferred / elapsed : 0;
              setTransferProgress({
                bytesTransferred: totalBytesTransferred,
                totalBytes: fileSize,
                percentage: Math.min(1, totalBytesTransferred / fileSize) * 100,
                speed,
                timeRemaining: speed > 0 ? (fileSize - totalBytesTransferred) / speed : 0,
                activeStreams: channels.length,
                networkQuality,
                adaptiveChunkSize: CHUNK_SIZE,
                rttMs,
                candidateType,
                receiverBackpressureLevel: receiverBackpressureLevel === 'high' ? 'high' : 'low',
                cachedShardBytes,
                maxCachedShardBytes: MAX_CACHED_SHARD_BYTES
              });
            }
          }
        }
        
        // Wait for buffers to drain (silent)
        while (true) {
          const totalBuffered = channels.reduce((sum, ch) => sum + ch.bufferedAmount, 0);
          if (totalBuffered === 0) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Send completion (no CRC32 needed - all shards already verified)
        console.log(`✅ All shards sent!`);
        
        const completePayload: Record<string, any> = {
          type: 'multi_stream_complete',
          bytesTransferred: totalBytesTransferred,
          totalBytes: totalBytesTransferred,
          fileSize,
          timestamp: Date.now()
        };
        if (isFile) {
          completePayload.totalCrc32 = finalizeCRC32(totalCrc32);
        }
        conn.send(completePayload);

        let receiverDone = false;
        const resendInterval = setInterval(() => {
          if (receiverDone) {
            clearInterval(resendInterval);
            return;
          }
          conn.send(completePayload);
        }, 2000);

        const waitForReceiverDone = () => new Promise<void>((resolveDone) => {
          const doneHandler = (data: any) => {
            if (data?.type === 'receiver_done') {
              receiverDone = true;
              clearInterval(resendInterval);
              conn.off('data', doneHandler);
              resolveDone();
            }
          };
          conn.on('data', doneHandler);

          setTimeout(() => {
            receiverDone = true;
            clearInterval(resendInterval);
            conn.off('data', doneHandler);
            resolveDone();
          }, 10 * 60 * 1000);
        });

        await waitForReceiverDone();
        conn.off('data', messageHandler);

        conn.off('data', receiverBackpressureHandler);

        channels.forEach(ch => ch.close());
        clearInterval(perfInterval);
        logPerf('sender-final');
        cryptoWorker?.terminate();
        setIsTransferring(false);
        clearInterval(qualityInterval);
        upsertResumeSession({
          transferId,
          role: 'sender',
          fileName: name,
          fileSize,
          lastModified: isFile ? (input as File).lastModified : undefined,
          shardSize: SHARD_SIZE,
          shardCount: shards.length,
          completedShardIds: Array.from(senderCompletedShardIds),
          updatedAt: Date.now(),
          status: 'complete'
        });
        removeResumeSession(transferId);
        resolve();
      } catch (error) {
        console.error('❌ Shard transfer error:', error);
        conn.off('data', receiverBackpressureHandler);
        clearInterval(perfInterval);
        cryptoWorker?.terminate();
        setIsTransferring(false);
        clearInterval(qualityInterval);
        reject(error);
      }
    });
  }, [createParallelChannels, setTransferProgress]);

  // Receive file with shard-based tracking
  const prepareDownloadBridge = useCallback(async (fileName: string, fileSize: number) => {
    if (!supportsDownloadBridge()) return null;

    const downloadKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const bridgeUrl = `${window.location.origin}/download-bridge/bridge.html`;

    return new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = bridgeUrl;
      document.body.appendChild(iframe);

      const cleanup = () => {
        channel.port1.close();
        channel.port2.close();
        iframe.remove();
      };

      const timeout = window.setTimeout(() => {
        cleanup();
        console.warn('⚠️ Download bridge timeout');
        resolve(null);
      }, 8000);

      const finalizeDownload = (downloadUrl?: string) => {
        window.clearTimeout(timeout);
        window.removeEventListener('message', handler);
        if (downloadUrl && iframe.contentWindow) {
          iframe.contentWindow.location.href = downloadUrl;
        }
        resolve(downloadKey);
      };

      channel.port1.onmessage = (event) => {
        if (event.data?.debug === 'download_ready') {
          console.log('✅ Download bridge ready');
        }
        if (event.data?.download) {
          finalizeDownload(event.data.download);
        }
      };

      function handler(event: MessageEvent) {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'download_bridge_download') {
          finalizeDownload(event.data.url);
        }
        if (event.data?.type === 'download_bridge_complete' && event.data?.downloadKey === downloadKey) {
          window.clearTimeout(timeout);
          cleanup();
        }
      }
      window.addEventListener('message', handler);

      iframe.onload = () => {
        iframe.onload = null;
        iframe.contentWindow?.postMessage({
          transferId: downloadKey,
          filename: fileName,
          size: fileSize,
          pathname: `download/${downloadKey}`
        }, window.location.origin, [channel.port2]);
      };
    });
  }, []);

  const receiveFileMultiStream = useCallback(async (
    conn: DataConnection,
    options?: ReceiveOptions
  ): Promise<void> => {
    console.log('📥 receiveFileMultiStream STARTED (SHARD-BASED)');
    
    return new Promise<void>((resolve, reject) => {
      setIsTransferring(true);
      startTime.current = Date.now();

      const cryptoWorker = createCryptoWorkerClient();
      const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const perfStats = {
        decryptMs: 0,
        decryptBytes: 0,
        crcMs: 0,
        crcBytes: 0,
        writeWaitMs: 0
      };
      const logPerf = (label: string) => {
        const crcPerMb = perfStats.crcBytes > 0 ? (perfStats.crcMs / (perfStats.crcBytes / (1024 * 1024))).toFixed(2) : '0';
        const decPerMb = perfStats.decryptBytes > 0 ? (perfStats.decryptMs / (perfStats.decryptBytes / (1024 * 1024))).toFixed(2) : '0';
        console.log(`⚙️ ${label} perf`, {
          decryptMs: Math.round(perfStats.decryptMs),
          decryptBytesMB: +(perfStats.decryptBytes / (1024 * 1024)).toFixed(1),
          decryptMsPerMB: decPerMb,
          crcMs: Math.round(perfStats.crcMs),
          crcBytesMB: +(perfStats.crcBytes / (1024 * 1024)).toFixed(1),
          crcMsPerMB: crcPerMb,
          writeWaitMs: Math.round(perfStats.writeWaitMs)
        });
      };
      const perfInterval = setInterval(() => {
        logPerf('receiver');
      }, 5000);

      let fileSize = 0;
      let expectedTotalBytes: number | null = null;
      let expectedTotalCrc32: string | null = null;
      let totalCrc32 = 0xFFFFFFFF;
      let expectedStreams = 0;
      let shardSize = 0;
      let shardCount = 0;
      let chunkHeaderBytes = 8;
      let metaResendAttempts = 0;
      const MAX_META_RESEND_ATTEMPTS = 3;
      let bytesReceived = 0;
      let lastLoggedPercentage = 0;

      let lastBytesReceived = 0;
      let lastProgressTs = Date.now();
      const stallInterval = setInterval(() => {
        if (!isTransferDebugEnabled()) return;
        const now = Date.now();
        if (bytesReceived !== lastBytesReceived) {
          lastBytesReceived = bytesReceived;
          lastProgressTs = now;
          return;
        }
        if (now - lastProgressTs < 5000) return;

        const missing = Array.from(shardStates.entries())
          .filter(([_, state]) => !state.complete)
          .map(([id, state]) => ({ id, received: state.received, total: state.total, hasCrc: !!state.expectedCRC }));
        debugLog('🧪 receiver stalled', {
          bytesReceived,
          fileSize,
          completeSignalReceived,
          missing: missing.slice(0, 10)
        });

        const missingShardIds = missing.map(s => s.id);
        if (missingShardIds.length > 0) {
          conn.send({ type: 'retransmit_shards', shardIds: missingShardIds, timestamp: Date.now() });
          conn.send({ type: 'request_shard_meta', shardIds: missingShardIds, timestamp: Date.now() });
        }
      }, 1000);

      let transferId = '';
      let receiverResumeSession: ResumeSession | null = null;
      const receiverCompletedShardIds = new Set<number>();

      let encryptionState: EncryptionState | null = null;
      let encryptionEnabled = false;
      let encryptionIvBytes = 0;
      const handshakePromise = performEcdhHandshake(conn, 'receiver')
        .then((result) => {
          encryptionState = result.state;
          encryptionEnabled = result.state.enabled;
          encryptionIvBytes = result.state.ivBytes;
          if (!transferId) {
            transferId = result.transferId;
          }
        })
        .catch((error) => {
          console.error('❌ ECDH handshake failed (receiver):', error);
          setIsTransferring(false);
          reject(error instanceof Error ? error : new Error('ECDH handshake failed'));
        });

      let networkQuality: AdaptiveTransferProgress['networkQuality'] = 'good';
      let rttMs: number | undefined;
      let candidateType: string | undefined;

      let completeSignalReceived = false;
      let finalizeStarted = false;

      let incomingFileName = 'download';

      let cachedShardBytes = 0;
      const storedShardIds = new Set<number>();

      let bridgeMessageHandler: ((event: MessageEvent) => void) | null = null;
      let downloadBridgeComplete = false;
      let downloadBridgeCompleteResolve: (() => void) | null = null;
      let downloadBridgeCompletePromise: Promise<void> | null = null;
      const ensureDownloadBridgePromise = () => {
        if (!downloadBridgeCompletePromise) {
          downloadBridgeCompletePromise = new Promise<void>((resolve) => {
            downloadBridgeCompleteResolve = resolve;
          });
        }
      };
      const markDownloadBridgeComplete = () => {
        if (downloadBridgeComplete) return;
        downloadBridgeComplete = true;
        if (downloadBridgeCompleteResolve) {
          downloadBridgeCompleteResolve();
        }
      };
      const attachBridgeListener = () => {
        if (bridgeMessageHandler || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        bridgeMessageHandler = (event: MessageEvent) => {
          const data = (event as MessageEvent).data;
          if (!data) return;
          if (data.type === 'download_bridge_shard_deleted') {
            if (transferId && data.transferId && data.transferId !== transferId) return;
            if (typeof data.size === 'number') {
              cachedShardBytes = Math.max(0, cachedShardBytes - data.size);
              maybeSendBackpressure();
            }
            return;
          }
          if (data.type === 'download_bridge_complete') {
            if (downloadKey && data.downloadKey && data.downloadKey !== downloadKey) return;
            if (transferId && data.transferId && data.transferId !== transferId) return;
            markDownloadBridgeComplete();
          }
        };
        navigator.serviceWorker.addEventListener('message', bridgeMessageHandler);
      };
      const detachBridgeListener = () => {
        if (!bridgeMessageHandler || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.removeEventListener('message', bridgeMessageHandler);
        bridgeMessageHandler = null;
      };

      let useBlobDownload = false;
      let downloadKey: string | null = options?.downloadKey ?? null;
      if (downloadKey) {
        ensureDownloadBridgePromise();
      }

      const MAX_WRITE_BUFFER_BYTES = 512 * 1024 * 1024;
      const HIGH_WATERMARK_BYTES = 384 * 1024 * 1024;
      const LOW_WATERMARK_BYTES = 256 * 1024 * 1024;
      const MAX_INFLIGHT_WRITES = 8;

      let queuedOrInFlightBytes = 0;
      let inFlightWrites = 0;
      let receiverBackpressureLevel: 'low' | 'high' = 'low';
      const writeQueue: Array<{ position: number; data: Uint8Array; size: number }> = [];

      const resetShardForRetry = async (shardId: number, shardState: { received: number; total: number; complete: boolean; expectedCRC: string; currentCRC: number; attemptId: number; offset: number; }) => {
        if (shardState.received > 0) {
          bytesReceived = Math.max(0, bytesReceived - shardState.received);
        }
        shardState.received = 0;
        shardState.complete = false;
        shardState.currentCRC = 0xFFFFFFFF;
        shardState.attemptId += 1;

        const existingBuffer = shardBuffers.get(shardId);
        if (existingBuffer) {
          cachedShardBytes = Math.max(0, cachedShardBytes - existingBuffer.byteLength);
          shardBuffers.delete(shardId);
        }

        if (storedShardIds.has(shardId) && transferId) {
          storedShardIds.delete(shardId);
          await deleteShard(transferId, shardId);
        }

        maybeSendBackpressure();
      };

      const updateCrc = async (crc: number, data: Uint8Array) => {
        const start = perfNow();
        let next = crc;
        if (cryptoWorker) {
          next = await cryptoWorker.crc32(crc, data);
        } else {
          next = updateCRC32(crc, data);
        }
        perfStats.crcMs += perfNow() - start;
        perfStats.crcBytes += data.byteLength;
        return next;
      };

      const verifyAndConfirmShard = async (shardId: number, shardState: { received: number; total: number; complete: boolean; expectedCRC: string; currentCRC: number; attemptId: number; offset: number; }) => {
        if (!shardState.expectedCRC) return false;
        const actualCRC = finalizeCRC32(shardState.currentCRC);
        if (actualCRC === shardState.expectedCRC) {
          shardState.complete = true;
          receiverCompletedShardIds.add(shardId);
          conn.send({
            type: 'shard_confirmed',
            shardId: shardId,
            timestamp: Date.now()
          });
          if (transferId && receiverResumeSession) {
            upsertResumeSession({
              ...receiverResumeSession,
              completedShardIds: Array.from(receiverCompletedShardIds),
              updatedAt: Date.now(),
              status: 'in_progress'
            });
          }
          return true;
        }

        console.error(`❌ Shard ${shardId} CRC32 mismatch! Expected: ${shardState.expectedCRC}, Got: ${actualCRC}`);
        await resetShardForRetry(shardId, shardState);
        conn.send({
          type: 'retransmit_shards',
          shardIds: [shardId],
          timestamp: Date.now()
        });
        return false;
      };

      const maybeSendBackpressure = () => {
        const cachedBytes = useFileSystemAPI ? queuedOrInFlightBytes : cachedShardBytes;
        const highWatermark = useFileSystemAPI ? HIGH_WATERMARK_BYTES : MAX_INDEXEDDB_CACHE_BYTES;
        const lowWatermark = useFileSystemAPI ? LOW_WATERMARK_BYTES : LOW_INDEXEDDB_CACHE_BYTES;

        if (cachedBytes >= highWatermark && receiverBackpressureLevel !== 'high') {
          receiverBackpressureLevel = 'high';
          conn.send({ type: 'receiver_backpressure', level: 'high', bytes: cachedBytes, timestamp: Date.now() });
        } else if (cachedBytes <= lowWatermark && receiverBackpressureLevel !== 'low') {
          receiverBackpressureLevel = 'low';
          conn.send({ type: 'receiver_backpressure', level: 'low', bytes: cachedBytes, timestamp: Date.now() });
        }
      };


      const pumpWrites = () => {
        if (!useFileSystemAPI || !writableStream) return;
        while (inFlightWrites < MAX_INFLIGHT_WRITES && writeQueue.length > 0) {
          const item = writeQueue.shift()!;
          inFlightWrites++;
          writableStream.write({
            type: 'write',
            position: item.position,
            data: item.data
          }).then(() => {
            inFlightWrites--;
            queuedOrInFlightBytes -= item.size;
            maybeSendBackpressure();
            pumpWrites();
          }).catch((error: any) => {
            inFlightWrites--;
            queuedOrInFlightBytes -= item.size;
            maybeSendBackpressure();
            console.error('❌ Chunk write failed:', error);
            pumpWrites();
          });
        }
      };

      const enqueueWrite = async (position: number, data: Uint8Array) => {
        const size = data.byteLength;
        while (queuedOrInFlightBytes + size > MAX_WRITE_BUFFER_BYTES) {
          const waitStart = perfNow();
          maybeSendBackpressure();
          await new Promise(resolve => setTimeout(resolve, 10));
          perfStats.writeWaitMs += perfNow() - waitStart;
        }
        queuedOrInFlightBytes += size;
        writeQueue.push({ position, data, size });
        maybeSendBackpressure();
        pumpWrites();
      };

      const finalizeIfReady = async () => {
        if (finalizeStarted) return;
        const missingShards = Array.from(shardStates.entries())
          .filter(([_, state]) => !state.complete)
          .map(([id]) => id);
        if (missingShards.length > 0) return;
        const expectedBytes = expectedTotalBytes ?? fileSize;
        if (!completeSignalReceived) {
          if (expectedBytes > 0 && bytesReceived === expectedBytes) {
            console.warn('⚠️ Missing complete signal, finalizing based on shard completion', {
              bytesReceived,
              expectedBytes
            });
            completeSignalReceived = true;
            if (expectedTotalBytes === null) {
              expectedTotalBytes = expectedBytes;
            }
          } else {
            return;
          }
        }
        if (expectedTotalBytes !== null && bytesReceived !== expectedTotalBytes) {
          console.error('❌ Total bytes mismatch', {
            received: bytesReceived,
            expected: expectedTotalBytes
          });
          setIsTransferring(false);
          reject(new Error('Total bytes mismatch'));
          return;
        }
        if (expectedTotalCrc32) {
          let orderedTotalCrc32: string | null = null;
          if (!useFileSystemAPI && !useBlobDownload && transferId && shardCount > 0) {
            let orderedCrc = 0xFFFFFFFF;
            for (let i = 0; i < shardCount; i++) {
              const state = shardStates.get(i);
              let shardData = shardBuffers.get(i);
              if (!shardData && transferId) {
                const stored = await getShard(transferId, i);
                if (stored) {
                  shardData = new Uint8Array(stored);
                }
              }
              if (!shardData) {
                console.error('❌ Missing shard data for total CRC32 recompute', { shardId: i });
                orderedCrc = 0xFFFFFFFF;
                break;
              }
              const expectedLength = state?.total ?? shardData.byteLength;
              const normalized = shardData.byteLength > expectedLength
                ? shardData.subarray(0, expectedLength)
                : shardData;
              orderedCrc = await updateCrc(orderedCrc, normalized);
            }
            orderedTotalCrc32 = finalizeCRC32(orderedCrc);
          }

          const actualTotalCrc32 = orderedTotalCrc32 ?? finalizeCRC32(totalCrc32);
          if (actualTotalCrc32 !== expectedTotalCrc32) {
            console.error('❌ Total CRC32 mismatch', {
              expected: expectedTotalCrc32,
              actual: actualTotalCrc32
            });
            setIsTransferring(false);
            reject(new Error('Total CRC32 mismatch'));
            return;
          }
        }
        finalizeStarted = true;
        if (useFileSystemAPI && writableStream) {
          while (queuedOrInFlightBytes > 0 || inFlightWrites > 0 || writeQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          await writableStream.close();
          conn.send({ type: 'receiver_done', timestamp: Date.now() });
          clearInterval(perfInterval);
          logPerf('receiver-final');
          cryptoWorker?.terminate();
          setIsTransferring(false);
          detachBridgeListener();
          await clearTransfer(transferId);
          removeResumeSession(transferId);
          resolve();
          return;
        }

        if (!useFileSystemAPI) {
          if (downloadKey && !useBlobDownload && downloadBridgeCompletePromise) {
            let completionObserved = false;
            await Promise.race([
              downloadBridgeCompletePromise.then(() => {
                completionObserved = true;
              }),
              new Promise<void>((resolve) => setTimeout(resolve, 60000))
            ]);
            if (!completionObserved) {
              console.warn('⚠️ Download bridge completion timeout', { downloadKey });
            }
          }
          conn.send({ type: 'receiver_done', timestamp: Date.now() });
          clearInterval(perfInterval);
          logPerf('receiver-final');
          cryptoWorker?.terminate();
          setIsTransferring(false);
          detachBridgeListener();
          await clearTransfer(transferId);
          removeResumeSession(transferId);
          resolve();
          return;
        }

        if (useBlobDownload) {
          const parts: ArrayBuffer[] = [];
          for (let i = 0; i < shardCount; i++) {
            const buf = shardBuffers.get(i);
            const state = shardStates.get(i);
            if (!buf || !state) {
              console.error('❌ Missing shard buffer during blob finalize', { shardId: i });
              setIsTransferring(false);
              reject(new Error('Missing shard buffer'));
              return;
            }
            parts.push(buf.buffer.slice(buf.byteOffset, buf.byteOffset + state.total) as ArrayBuffer);
          }
          const blob = new Blob(parts, { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = incomingFileName || 'download';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 0);

          conn.send({ type: 'receiver_done', timestamp: Date.now() });
          clearInterval(perfInterval);
          clearInterval(stallInterval);
          logPerf('receiver-final');
          cryptoWorker?.terminate();
          setIsTransferring(false);
          detachBridgeListener();
          resolve();
          return;
        }

        console.error('❌ No save method available after transfer');
        clearInterval(perfInterval);
        clearInterval(stallInterval);
        cryptoWorker?.terminate();
        setIsTransferring(false);
        detachBridgeListener();
        reject(new Error('No save method available'));
      };
      
      // Shard tracking with CRC32 verification and immediate writes
      const shardStates = new Map<number, { 
        received: number, 
        total: number, 
        complete: boolean, 
        expectedCRC: string,
        currentCRC: number, // Incremental CRC32 calculation
        attemptId: number,
        offset: number // Shard offset in file
      }>();
      const shardBuffers = new Map<number, Uint8Array>();
      const shardProcessQueue = new Map<number, Promise<void>>();
      
      let fileHandle: any = null;
      let writableStream: any = null;
      let useFileSystemAPI = false;
      const requireSave = options?.requireSave ?? false;

      const setupDataChannelHandlers = () => {
        const pc = (conn as any).peerConnection;
        if (!pc) {
          console.error('❌ PeerConnection not available yet');
          return;
        }
        
        console.log('✅ Setting up DataChannel handlers on receiver');
        
        pc.ondatachannel = (event: RTCDataChannelEvent) => {
          console.log(`📡 Received DataChannel: ${event.channel.label}`);
          const channel = event.channel;
          try {
            channel.binaryType = 'arraybuffer';
          } catch {
            // ignore
          }

          channel.onmessage = async (event) => {
            let payload: ArrayBuffer | null = null;
            if (event.data instanceof ArrayBuffer) {
              payload = event.data;
            } else if (event.data instanceof Blob) {
              payload = await event.data.arrayBuffer();
            } else {
              return;
            }
            
            const message = new Uint8Array(payload);
            if (message.byteLength < chunkHeaderBytes) return;
            const view = new DataView(message.buffer);
            const shardId = view.getUint32(0, true);
            const attemptId = chunkHeaderBytes >= 8 ? view.getUint32(4, true) : 0;
            const queued = shardProcessQueue.get(shardId) ?? Promise.resolve();
            const next = queued
              .catch(() => undefined)
              .then(async () => {
                if (!encryptionState && chunkHeaderBytes > 8) {
                  return;
                }
                if (shardStates.size === 0) {
                  return;
                }

                let chunkData = message.subarray(chunkHeaderBytes);

                if (encryptionEnabled) {
                  if (!encryptionState) {
                    console.error('❌ Encrypted chunk received before ECDH handshake');
                    return;
                  }
                  const ivStart = 8;
                  const ivEnd = ivStart + encryptionIvBytes;
                  if (message.byteLength <= ivEnd) return;
                  const iv = message.subarray(ivStart, ivEnd);
                  const encryptedPayload = message.subarray(ivEnd);
                  try {
                    const start = perfNow();
                    if (cryptoWorker) {
                      const ivCopy = iv.slice();
                      const encryptedCopy = encryptedPayload.slice();
                      const { decrypted } = await cryptoWorker.decrypt(shardId, attemptId, ivCopy, encryptedCopy);
                      chunkData = new Uint8Array(decrypted);
                    } else {
                      const decrypted = await decryptChunk(
                        encryptionState.key,
                        shardId,
                        attemptId,
                        iv,
                        encryptedPayload
                      );
                      chunkData = new Uint8Array(decrypted);
                    }
                    perfStats.decryptMs += perfNow() - start;
                    perfStats.decryptBytes += chunkData.byteLength;
                  } catch (error) {
                    console.error('❌ Failed to decrypt chunk', error);
                    return;
                  }
                }

                // Update shard state
                if (!shardStates.has(shardId)) {
                  console.error(`❌ Received data for unknown shard ${shardId}`);
                  return;
                }

                const shardState = shardStates.get(shardId)!;

                if (shardState.complete) {
                  return;
                }

                if (attemptId > shardState.attemptId) {
                  await resetShardForRetry(shardId, shardState);
                  shardState.attemptId = attemptId;
                }

                if (attemptId !== shardState.attemptId) {
                  return;
                }

                const remaining = shardState.total - shardState.received;
                if (remaining <= 0) {
                  return;
                }

                const accepted = chunkData.byteLength > remaining ? chunkData.subarray(0, remaining) : chunkData;
                const prevReceived = shardState.received;
                shardState.received += accepted.length;
                bytesReceived += accepted.length;

                // Update incremental CRC32 for this shard
                shardState.currentCRC = await updateCrc(shardState.currentCRC, accepted);

                // Write chunk to disk immediately (non-blocking)
                if (useFileSystemAPI && writableStream) {
                  const chunkOffset = shardState.offset + prevReceived;
                  await enqueueWrite(chunkOffset, accepted);
                } else {
                  let shardBuffer = shardBuffers.get(shardId);
                  if (!shardBuffer || shardBuffer.byteLength !== shardState.total) {
                    if (shardBuffer) {
                      cachedShardBytes = Math.max(0, cachedShardBytes - shardBuffer.byteLength);
                    }
                    shardBuffer = new Uint8Array(shardState.total);
                    shardBuffers.set(shardId, shardBuffer);
                    cachedShardBytes += shardState.total;
                    maybeSendBackpressure();
                  }
                  shardBuffer.set(accepted, prevReceived);
                }

                // Shard complete? Verify CRC32
                if (shardState.received >= shardState.total) {
                  if (!shardState.expectedCRC) {
                    console.warn('⚠️ Shard completed without CRC metadata, finalizing based on byte count', {
                      shardId,
                      received: shardState.received,
                      total: shardState.total
                    });
                    shardState.complete = true;
                    conn.send({
                      type: 'shard_confirmed',
                      shardId,
                      timestamp: Date.now()
                    });
                    await finalizeIfReady();
                    return;
                  }
                  console.log(`🔍 Shard ${shardId} complete: ${shardState.received}/${shardState.total} bytes, expectedCRC: ${shardState.expectedCRC}`);
                  const shardVerified = await verifyAndConfirmShard(shardId, shardState);

                  if (shardVerified && !useFileSystemAPI) {
                    const shardBuffer = shardBuffers.get(shardId);
                    if (shardBuffer) {
                      totalCrc32 = await updateCrc(totalCrc32, shardBuffer);
                    }
                  }

                  if (shardVerified && !useFileSystemAPI && transferId && !storedShardIds.has(shardId)) {
                    const shardBuffer = shardBuffers.get(shardId);
                    if (!shardBuffer) {
                      console.warn('⚠️ Shard buffer missing on completion', { shardId });
                    } else {
                      const data = shardBuffer.buffer.slice(shardBuffer.byteOffset, shardBuffer.byteOffset + shardState.total) as ArrayBuffer;
                      try {
                        await putShard(transferId, shardId, data);
                        storedShardIds.add(shardId);
                        shardBuffers.delete(shardId);
                        // Keep cachedShardBytes accounting for persisted shard; service worker deletion will decrement.
                        maybeSendBackpressure();
                      } catch (error) {
                        console.error('❌ Failed to persist shard to IndexedDB', error);
                      }
                    }
                  }
                }

                // Update progress
                const now = Date.now();
                const elapsed = (now - startTime.current) / 1000;
                const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
                const currentPercentage = Math.floor(Math.min(1, bytesReceived / fileSize) * 100);

                // Log every 10% milestone
                if (currentPercentage >= lastLoggedPercentage + 10) {
                  console.log(`📥 ${currentPercentage}% received (${(bytesReceived/1024/1024/1024).toFixed(2)}GB / ${(fileSize/1024/1024/1024).toFixed(2)}GB) @ ${(speed/1024/1024).toFixed(1)}MB/s`);
                  lastLoggedPercentage = currentPercentage;
                }

                setTransferProgress({
                  bytesTransferred: bytesReceived,
                  totalBytes: fileSize,
                  percentage: Math.min(1, bytesReceived / fileSize) * 100,
                  speed,
                  timeRemaining: speed > 0 ? (fileSize - bytesReceived) / speed : 0,
                  activeStreams: expectedStreams,
                  networkQuality,
                  adaptiveChunkSize: 256 * 1024,
                  rttMs,
                  candidateType,
                  receiverBackpressureLevel,
                  cachedShardBytes: useFileSystemAPI ? undefined : cachedShardBytes,
                  maxCachedShardBytes: useFileSystemAPI ? undefined : MAX_INDEXEDDB_CACHE_BYTES
                });

                await finalizeIfReady();
              });

            shardProcessQueue.set(shardId, next);
            try {
              await next;
            } finally {
              if (shardProcessQueue.get(shardId) === next) {
                shardProcessQueue.delete(shardId);
              }
            }
          };
        };
      };

      const handleMainMessage = async (data: any) => {
        if (data.type === 'multi_stream_start') {
          console.log('📥 receiveFileMultiStream STARTED (SHARD-BASED)');

          try {
            await handshakePromise;
          } catch (error) {
            console.error('❌ ECDH handshake failed before metadata:', error);
            return;
          }

          if (encryptionState?.enabled && cryptoWorker) {
            try {
              await cryptoWorker.init(encryptionState.key, encryptionState.ivBytes);
            } catch (error) {
              console.warn('⚠️ Crypto worker init failed, falling back to main thread', error);
              cryptoWorker.terminate();
            }
          }

          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          shardSize = data.shardSize;
          shardCount = data.shardCount;
          chunkHeaderBytes = data.chunkHeaderBytes;
          metaResendAttempts = 0;
          if (!transferId) {
            transferId = String(data.transferId || '');
          }

          if (!transferId) {
            console.error('❌ Missing transferId for encrypted transfer');
            setIsTransferring(false);
            reject(new Error('Missing transferId'));
            return;
          }

          if (!data.encryption?.enabled) {
            console.error('❌ Encryption metadata missing from sender');
            setIsTransferring(false);
            reject(new Error('Encryption required'));
            return;
          }

          if (data.encryption?.enabled && !encryptionState) {
            console.error('❌ Encryption metadata received without ECDH key');
            setIsTransferring(false);
            reject(new Error('Encryption handshake missing'));
            return;
          }

          if (data.encryption?.enabled) {
            encryptionEnabled = true;
            encryptionIvBytes = data.encryption.ivBytes ?? encryptionIvBytes;
            chunkHeaderBytes = 8 + encryptionIvBytes;
          }

          attachBridgeListener();

          if (typeof data.fileName === 'string' && data.fileName.length > 0) {
            incomingFileName = data.fileName;
          }

          receiverResumeSession = (() => {
            const sessions = loadResumeSessions();
            const existing = sessions[transferId];
            if (!existing || existing.role !== 'receiver' || existing.status !== 'in_progress') {
              return null;
            }
            if (existing.fileName !== incomingFileName || existing.fileSize !== fileSize) {
              return null;
            }
            if (existing.shardSize !== shardSize || existing.shardCount !== shardCount) {
              return null;
            }
            return existing;
          })();

          console.log(`📊 Expecting ${shardCount} shards of ${(shardSize / 1024 / 1024).toFixed(0)}MB each`);

          // Initialize shard states
          for (let i = 0; i < shardCount; i++) {
            const offset = i * shardSize;
            const remaining = Math.max(0, fileSize - offset);
            const total = Math.min(shardSize, remaining);
            shardStates.set(i, {
              received: 0,
              total,
              complete: false,
              expectedCRC: '',
              currentCRC: 0xFFFFFFFF,
              attemptId: 0,
              offset
            });
          }

          if (receiverResumeSession?.completedShardIds?.length) {
            receiverResumeSession.completedShardIds.forEach((id) => {
              const state = shardStates.get(id);
              if (!state) return;
              state.received = state.total;
              state.complete = true;
              receiverCompletedShardIds.add(id);
              bytesReceived += state.total;
            });
          }

          setTransferProgress({
            bytesTransferred: bytesReceived,
            totalBytes: fileSize,
            percentage: fileSize > 0 ? (bytesReceived / fileSize) * 100 : 0,
            speed: 0,
            timeRemaining: 0,
            activeStreams: expectedStreams,
            networkQuality,
            adaptiveChunkSize: 0,
            rttMs,
            candidateType,
            receiverBackpressureLevel,
            cachedShardBytes: 0,
            maxCachedShardBytes: MAX_INDEXEDDB_CACHE_BYTES
          });

          upsertResumeSession({
            transferId,
            role: 'receiver',
            fileName: incomingFileName,
            fileSize,
            shardSize,
            shardCount,
            completedShardIds: Array.from(receiverCompletedShardIds),
            updatedAt: Date.now(),
            status: 'in_progress'
          });

          if (options?.fileHandle) {
            try {
              fileHandle = options.fileHandle;
              writableStream = await fileHandle.createWritable({ keepExistingData: false });
              useFileSystemAPI = true;
              console.log('✅ File System Access API active', { name: fileHandle?.name ?? 'unnamed' });
            } catch (err) {
              console.error('❌ File System Access API failed', err);
              useFileSystemAPI = false;
            }
          }

          if (!useFileSystemAPI) {
            useBlobDownload = shouldUseBlobDownload(fileSize);

            if (!useBlobDownload && !downloadKey && supportsDownloadBridge()) {
              downloadKey = await prepareDownloadBridge(incomingFileName, fileSize);
              if (downloadKey) {
                ensureDownloadBridgePromise();
              }
            }

            if (downloadKey) {
              await putTransferMeta({
                transferId,
                downloadKey,
                fileName: incomingFileName,
                fileSize,
                shardSize,
                shardCount
              });
            }

            if (!useBlobDownload && !downloadKey && requireSave) {
              console.error('❌ No save method available (File System Access + Download bridge unavailable)');
              setIsTransferring(false);
              reject(new Error('No save method available'));
              return;
            }
          }

          // Wait for peerConnection to be ready before setting up handlers
          await new Promise<void>((resolve) => {
            const checkConnection = () => {
              const pc = (conn as any).peerConnection;
              if (pc && pc.connectionState !== 'closed') {
                console.log(`✅ PeerConnection ready (state: ${pc.connectionState})`);

                const updateQualityFromStats = async () => {
                  if (!pc || typeof pc.getStats !== 'function') return;
                  const stats = await pc.getStats();
                  let localCandidateType: string | undefined;
                  let remoteCandidateType: string | undefined;
                  let localCandidateId: string | undefined;
                  let remoteCandidateId: string | undefined;

                  stats.forEach((report: any) => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
                      if (typeof report.currentRoundTripTime === 'number') {
                        rttMs = report.currentRoundTripTime * 1000;
                      }
                      localCandidateId = report.localCandidateId;
                      remoteCandidateId = report.remoteCandidateId;
                    }
                  });

                  if (localCandidateId || remoteCandidateId) {
                    stats.forEach((report: any) => {
                      if (localCandidateId && report.id === localCandidateId) {
                        localCandidateType = report.candidateType;
                      }
                      if (remoteCandidateId && report.id === remoteCandidateId) {
                        remoteCandidateType = report.candidateType;
                      }
                    });
                  }

                  if (typeof rttMs === 'number') {
                    if (localCandidateType === 'host' && remoteCandidateType === 'host' && rttMs <= 5) {
                      networkQuality = 'excellent';
                    } else if (rttMs <= 30) {
                      networkQuality = 'good';
                    } else if (rttMs <= 120) {
                      networkQuality = 'fair';
                    } else {
                      networkQuality = 'poor';
                    }
                  } else {
                    networkQuality = pc.connectionState === 'connected' ? 'good' : 'poor';
                  }

                  if (localCandidateType && remoteCandidateType) {
                    candidateType = `${localCandidateType}/${remoteCandidateType}`;
                  } else if (localCandidateType || remoteCandidateType) {
                    candidateType = localCandidateType || remoteCandidateType;
                  }
                };

                void updateQualityFromStats();
                setInterval(() => {
                  void updateQualityFromStats();
                }, 1000);

                setupDataChannelHandlers();
                resolve();
              } else {
                console.log('⏳ Waiting for peerConnection...');
                setTimeout(checkConnection, 100);
              }
            };
            checkConnection();
          });

          const navAny = navigator as any;
          const connInfo = navAny.connection || navAny.mozConnection || navAny.webkitConnection;

          const receiverProfile: ReceiverDeviceProfile = {
            hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : undefined,
            deviceMemoryGB: typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : undefined,
            isFirefox: isFirefoxBrowser(),
            supportsDownloadBridge: supportsDownloadBridge(),
            connection: connInfo ? {
              effectiveType: typeof connInfo.effectiveType === 'string' ? connInfo.effectiveType : undefined,
              downlinkMbps: typeof connInfo.downlink === 'number' ? connInfo.downlink : undefined,
              rttMs: typeof connInfo.rtt === 'number' ? connInfo.rtt : undefined,
              saveData: typeof connInfo.saveData === 'boolean' ? connInfo.saveData : undefined
            } : undefined
          };

          console.log('📡 Sending receiver_ready', {
            transferId,
            preferredStreamCount: receiverProfile.preferredStreamCount,
            isFirefox: receiverProfile.isFirefox,
            supportsDownloadBridge: receiverProfile.supportsDownloadBridge
          });

          conn.send({
            type: 'receiver_ready',
            receiverProfile,
            timestamp: Date.now()
          });

          conn.send({
            type: 'resume_state',
            transferId,
            completedShardIds: Array.from(receiverCompletedShardIds),
            timestamp: Date.now()
          });
        } else if (data.type === 'shard_start') {
          let state = shardStates.get(data.shardId);
          if (!state) {
            state = {
              received: 0,
              total: data.size,
              complete: false,
              expectedCRC: data.crc32 || '',
              currentCRC: 0xFFFFFFFF,
              attemptId: data.attemptId || 0,
              offset: data.offset || 0
            };
            shardStates.set(data.shardId, state);
          } else {
            if (typeof data.attemptId === 'number' && data.attemptId !== state.attemptId) {
              state.attemptId = data.attemptId;
              state.received = 0;
              state.complete = false;
              state.currentCRC = 0xFFFFFFFF;
            }
            state.total = data.size;
            if (data.crc32) state.expectedCRC = data.crc32;
            state.offset = data.offset || state.offset;
          }

          if (!useFileSystemAPI) {
            const existing = shardBuffers.get(data.shardId);
            if (!existing || existing.byteLength !== state.total) {
              if (existing) {
                cachedShardBytes = Math.max(0, cachedShardBytes - existing.byteLength);
              }
              shardBuffers.set(data.shardId, new Uint8Array(state.total));
              cachedShardBytes += state.total;
              maybeSendBackpressure();
            }
          }

          if (!state.complete && state.expectedCRC && state.received >= state.total) {
            verifyAndConfirmShard(data.shardId, state);
          }
        } else if (data.type === 'multi_stream_complete') {
          console.log('✅ Transfer complete signal (sender)');

          completeSignalReceived = true;
          if (typeof data.totalBytes === 'number') {
            expectedTotalBytes = data.totalBytes;
          }
          if (typeof data.totalCrc32 === 'string') {
            expectedTotalCrc32 = data.totalCrc32;
          }

          const requestMissingAfterSettle = (retriesLeft: number) => {
            const states = Array.from(shardStates.entries());
            const shardsMissingMeta = states.filter(([_, state]) => !state.expectedCRC).map(([id]) => id);
            if (shardsMissingMeta.length > 0 && retriesLeft > 0) {
              setTimeout(() => requestMissingAfterSettle(retriesLeft - 1), 1000);
              return;
            }

            if (shardsMissingMeta.length > 0 && metaResendAttempts < MAX_META_RESEND_ATTEMPTS) {
              metaResendAttempts++;
              conn.send({
                type: 'request_shard_meta',
                shardIds: shardsMissingMeta,
                timestamp: Date.now()
              });
              setTimeout(() => requestMissingAfterSettle(0), 1000);
              return;
            }

            const expectedBytes = expectedTotalBytes ?? fileSize;
            if (expectedBytes > 0 && bytesReceived < expectedBytes) {
              setTimeout(() => requestMissingAfterSettle(retriesLeft), 500);
              return;
            }

            const missingShards = states
              .filter(([_, state]) => state.expectedCRC && !state.complete)
              .map(([id]) => id);

            if (shardsMissingMeta.length > 0) {
              missingShards.push(...shardsMissingMeta);
            }

            if (missingShards.length > 0) {
              console.error(`❌ Missing ${missingShards.length} shards:`, missingShards.slice(0, 10));
              conn.send({
                type: 'retransmit_shards',
                shardIds: missingShards,
                timestamp: Date.now()
              });
              return;
            }

            void finalizeIfReady();
          };

          setTimeout(() => requestMissingAfterSettle(5), 2000);
          return;
        } else if (data.type === 'retransmit_complete') {
          console.log('✅ Retransmission complete');

          await finalizeIfReady();
        } else if (data.type === 'stream_count_update') {
          if (typeof data.streamCount === 'number') {
            expectedStreams = data.streamCount;
            console.log('📡 Receiver stream_count_update', {
              streamCount: data.streamCount,
              transferId
            });
          }
        }
      };

      conn.on('data', handleMainMessage);
    });
  }, [setTransferProgress]);

  const transferFileAdaptive = useCallback(async (
    conn: DataConnection,
    input: File | ReadableStream | null,
    fileName?: string,
    totalSize?: number,
    options?: ReceiveOptions
  ): Promise<void> => {
    const isSender = input !== null;
    
    if (isSender) {
      await sendFileMultiStream(conn, input, fileName, totalSize);
    } else {
      await receiveFileMultiStream(conn, options);
    }
  }, [sendFileMultiStream, receiveFileMultiStream]);

  return {
    transferFileAdaptive,
    transferProgress: transferProgressState,
    isTransferring,
    prepareDownloadBridge
  };
};
