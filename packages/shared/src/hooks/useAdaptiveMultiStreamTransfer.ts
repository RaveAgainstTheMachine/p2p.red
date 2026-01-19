import { useState, useRef, useCallback } from 'react';
import { DataConnection } from 'peerjs';
import streamSaver from 'streamsaver';
import { MultiStreamOrchestrator } from '../utils/multiStreamOrchestrator';
import { deleteShard, getShard, putShard } from '../utils/shardStore';

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

interface ReceiverDeviceProfile {
  hardwareConcurrency?: number;
  deviceMemoryGB?: number;
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

const MAX_INDEXEDDB_CACHE_BYTES = 512 * 1024 * 1024;
const LOW_INDEXEDDB_CACHE_BYTES = 384 * 1024 * 1024;

const supportsStreamSaver = () =>
  typeof window !== 'undefined' &&
  typeof window.WritableStream !== 'undefined' &&
  typeof window.ReadableStream !== 'undefined' &&
  'serviceWorker' in navigator;

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

export const useAdaptiveMultiStreamTransfer = () => {
  const [transferProgress, setTransferProgress] = useState<AdaptiveTransferProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0,
    activeStreams: 0,
    networkQuality: 'good',
    adaptiveChunkSize: 256 * 1024 // Start with 256KB
  });

  const [isTransferring, setIsTransferring] = useState(false);
  const startTime = useRef<number>(0);


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

      // Measure initial speed to determine shard size
      let estimatedSpeed = 50 * 1024 * 1024; // Default: 50 MB/s
      
      // Calculate shard size based on estimated speed
      const SHARD_SIZE = calculateShardSize(estimatedSpeed);
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
        conn.send({
          type: 'multi_stream_start',
          fileName: name,
          fileSize,
          streamCount: numChannels,
          shardSize: SHARD_SIZE,
          shardCount: shards.length,
          protocolVersion: 2,
          chunkHeaderBytes: 8,
          timestamp: Date.now()
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

        adjustedChannels = clamp(adjustedChannels, 4, Math.min(qualityMax, deviceMax, MAX_CHANNELS, shards.length));

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
          }
        };

        conn.send({
          type: 'stream_count_update',
          streamCount: channels.length,
          timestamp: Date.now()
        });

        let totalBytesTransferred = 0;
        const CHUNK_SIZE = 252 * 1024; // 252KB chunks (4 bytes reserved for shard ID header)
        let lastLoggedPercentage = 0;
        let lastUiProgressUpdateTs = 0;
        const UI_PROGRESS_UPDATE_INTERVAL_MS = 250;

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
              const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));

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
                // Use cached shard data from stream
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
              const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));
              
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
                
                const message = new Uint8Array(8 + chunkData.length);
                const view = new DataView(message.buffer);
                view.setUint32(0, shard.id, true);
                view.setUint32(4, attemptId, true);
                message.set(chunkData, 8);
                
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
              shard.status = 'sending';
              
              const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
              const shardData = new Uint8Array(await shardBlob.arrayBuffer());

              const attemptId = shardAttemptIds.get(shard.id) ?? 0;
              
              // Calculate per-shard CRC32
              const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));
              
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
                const message = new Uint8Array(8 + chunkData.length);
                const view = new DataView(message.buffer);
                view.setUint32(0, shard.id, true);
                view.setUint32(4, attemptId, true);
                message.set(chunkData, 8);
                
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
                  const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));

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
                    
                    const message = new Uint8Array(8 + chunkData.length);
                    const view = new DataView(message.buffer);
                    view.setUint32(0, shard.id, true);
                    view.setUint32(4, attemptId, true);
                    message.set(chunkData, 8);
                    
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
            
            if (done) {
              // Send final partial shard if any (only if we haven't already sent all shards)
              if (currentShardFilled > 0 && currentShardIndex < shards.length) {
                const shard = shards[currentShardIndex];
                if (!shard) {
                  console.log('✅ All shards sent, stream complete');
                  break;
                }
                const shardData = currentShardBuffer.slice(0, currentShardFilled);
                
                // Cache final shard until confirmed
                await waitForCacheRoom(shardData.length);
                shardCache.set(shard.id, shardData);
                cachedShardBytes += shardData.length;
                
                // Calculate per-shard CRC32
                const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));

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
                  const chunkData = shardData.subarray(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));

                  while (receiverBackpressureLevel === 'high') {
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }
                  
                  while (channel.bufferedAmount > 1 * 1024 * 1024) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }
                  
                  const message = new Uint8Array(8 + chunkData.length);
                  const view = new DataView(message.buffer);
                  view.setUint32(0, shard.id, true);
                  view.setUint32(4, attemptId, true);
                  message.set(chunkData, 8);
                  
                  channel.send(message.buffer);
                  sentBytes += chunkData.length;
                }
                
                totalBytesTransferred += shardData.length;
                shard.status = 'complete';
              }
              break;
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
        
        conn.send({
          type: 'multi_stream_complete',
          bytesTransferred: totalBytesTransferred,
          fileSize,
          timestamp: Date.now()
        });

        const waitForReceiverDone = () => new Promise<void>((resolveDone) => {
          const doneHandler = (data: any) => {
            if (data?.type === 'receiver_done') {
              conn.off('data', doneHandler);
              resolveDone();
            }
          };
          conn.on('data', doneHandler);

          setTimeout(() => {
            conn.off('data', doneHandler);
            resolveDone();
          }, 10 * 60 * 1000);
        });

        await waitForReceiverDone();
        conn.off('data', messageHandler);

        conn.off('data', receiverBackpressureHandler);

        channels.forEach(ch => ch.close());
        setIsTransferring(false);
        clearInterval(qualityInterval);
        resolve();
      } catch (error) {
        console.error('❌ Shard transfer error:', error);
        conn.off('data', receiverBackpressureHandler);
        setIsTransferring(false);
        clearInterval(qualityInterval);
        reject(error);
      }
    });
  }, [createParallelChannels, setTransferProgress]);

  // Receive file with shard-based tracking
  const receiveFileMultiStream = useCallback(async (
    conn: DataConnection
  ): Promise<Blob> => {
    console.log('📥 receiveFileMultiStream STARTED (SHARD-BASED)');
    
    return new Promise((resolve) => {
      setIsTransferring(true);
      startTime.current = Date.now();

      let fileSize = 0;
      let expectedStreams = 0;
      let fileName = 'download';
      let shardSize = 0;
      let shardCount = 0;
      let chunkHeaderBytes = 8;
      let metaResendAttempts = 0;
      const MAX_META_RESEND_ATTEMPTS = 3;
      let bytesReceived = 0;
      let lastLoggedPercentage = 0;

      let networkQuality: AdaptiveTransferProgress['networkQuality'] = 'good';
      let rttMs: number | undefined;
      let candidateType: string | undefined;

      let completeSignalReceived = false;
      let finalizeStarted = false;

      let useStreamSaver = false;
      let streamWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
      let transferId = '';
      let cachedShardBytes = 0;
      let nextShardToWrite = 0;
      const storedShardIds = new Set<number>();

      const MAX_WRITE_BUFFER_BYTES = 512 * 1024 * 1024;
      const HIGH_WATERMARK_BYTES = 384 * 1024 * 1024;
      const LOW_WATERMARK_BYTES = 256 * 1024 * 1024;
      const MAX_INFLIGHT_WRITES = 8;

      let queuedOrInFlightBytes = 0;
      let inFlightWrites = 0;
      let receiverBackpressureLevel: 'low' | 'high' = 'low';
      const writeQueue: Array<{ position: number; data: Uint8Array; size: number }> = [];

      const verifyAndConfirmShard = (shardId: number, shardState: { received: number; total: number; complete: boolean; expectedCRC: string; currentCRC: number; attemptId: number; offset: number; }) => {
        if (!shardState.expectedCRC) return;
        const actualCRC = finalizeCRC32(shardState.currentCRC);
        if (actualCRC === shardState.expectedCRC) {
          shardState.complete = true;
          conn.send({
            type: 'shard_confirmed',
            shardId: shardId,
            timestamp: Date.now()
          });
          return;
        }

        console.error(`❌ Shard ${shardId} CRC32 mismatch! Expected: ${shardState.expectedCRC}, Got: ${actualCRC}`);
        conn.send({
          type: 'retransmit_shards',
          shardIds: [shardId],
          timestamp: Date.now()
        });
        shardState.received = 0;
        shardState.complete = false;
        shardState.currentCRC = 0xFFFFFFFF;
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

      const flushStreamWriter = async () => {
        if (!useStreamSaver || !streamWriter) return;
        while (true) {
          const state = shardStates.get(nextShardToWrite);
          if (!state || !state.complete) break;
          let data: ArrayBuffer | null = null;

          const buffer = shardBuffers.get(nextShardToWrite);
          if (buffer) {
            data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + state.total) as ArrayBuffer;
            shardBuffers.delete(nextShardToWrite);
            cachedShardBytes = Math.max(0, cachedShardBytes - state.total);
          } else {
            data = await getShard(transferId, nextShardToWrite);
          }

          if (!data) break;
          await streamWriter.write(new Uint8Array(data));
          await deleteShard(transferId, nextShardToWrite);
          storedShardIds.delete(nextShardToWrite);
          nextShardToWrite += 1;
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
          maybeSendBackpressure();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        queuedOrInFlightBytes += size;
        writeQueue.push({ position, data, size });
        maybeSendBackpressure();
        pumpWrites();
      };

      const finalizeIfReady = async () => {
        if (finalizeStarted) return;
        if (!completeSignalReceived) return;
        const missingShards = Array.from(shardStates.entries())
          .filter(([_, state]) => !state.complete)
          .map(([id]) => id);
        if (missingShards.length > 0) return;
        finalizeStarted = true;
        if (useFileSystemAPI && writableStream) {
          while (queuedOrInFlightBytes > 0 || inFlightWrites > 0 || writeQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          await writableStream.close();
          conn.send({ type: 'receiver_done', timestamp: Date.now() });
          setIsTransferring(false);
          resolve(new Blob([]));
          return;
        }

        if (useStreamSaver && streamWriter) {
          await flushStreamWriter();
          await streamWriter.close();
          conn.send({ type: 'receiver_done', timestamp: Date.now() });
          setIsTransferring(false);
          resolve(new Blob([]));
          return;
        }

        const orderedShardIds = Array.from(shardStates.keys()).sort((a, b) => a - b);
        const blobParts = orderedShardIds.map((id) => {
          const state = shardStates.get(id);
          const buffer = shardBuffers.get(id);
          if (!state || !buffer) return new ArrayBuffer(0);
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + state.total) as ArrayBuffer;
        });
        conn.send({ type: 'receiver_done', timestamp: Date.now() });
        setIsTransferring(false);
        resolve(new Blob(blobParts, { type: 'application/octet-stream' }));
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
      
      let fileHandle: any = null;
      let writableStream: any = null;
      let useFileSystemAPI = false;

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

          channel.onmessage = async (event) => {
            if (!(event.data instanceof ArrayBuffer)) return;
            
            const message = new Uint8Array(event.data);
            if (message.byteLength < chunkHeaderBytes) return;
            const view = new DataView(message.buffer);
            const shardId = view.getUint32(0, true);
            const attemptId = chunkHeaderBytes >= 8 ? view.getUint32(4, true) : 0;
            const chunkData = message.subarray(chunkHeaderBytes);
            
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
              shardState.attemptId = attemptId;
              shardState.received = 0;
              shardState.complete = false;
              shardState.currentCRC = 0xFFFFFFFF;
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
            
            // Update incremental CRC32
            shardState.currentCRC = updateCRC32(shardState.currentCRC, accepted);
            
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
                return;
              }
              console.log(`🔍 Shard ${shardId} complete: ${shardState.received}/${shardState.total} bytes, expectedCRC: ${shardState.expectedCRC}`);
              verifyAndConfirmShard(shardId, shardState);

              if (useStreamSaver && streamWriter) {
                if (!storedShardIds.has(shardId) && shardId !== nextShardToWrite) {
                  const shardBuffer = shardBuffers.get(shardId);
                  if (shardBuffer) {
                    const data = shardBuffer.buffer.slice(shardBuffer.byteOffset, shardBuffer.byteOffset + shardState.total) as ArrayBuffer;
                    await putShard(transferId, shardId, data);
                    storedShardIds.add(shardId);
                    shardBuffers.delete(shardId);
                    cachedShardBytes = Math.max(0, cachedShardBytes - shardState.total);
                  }
                }

                await flushStreamWriter();
              }
            }
            
            // Note: Disk writes happen immediately per chunk (non-blocking)
            // This prevents RAM buffering while maintaining transfer speed
            
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
          };
        };
      };

      const handleMainMessage = async (data: any) => {
        if (data.type === 'multi_stream_start') {
          console.log('📥 receiveFileMultiStream STARTED (SHARD-BASED)');
          
          fileName = data.fileName;
          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          shardSize = data.shardSize;
          shardCount = data.shardCount;
          chunkHeaderBytes = data.chunkHeaderBytes === 8 ? 8 : 4;
          metaResendAttempts = 0;
          transferId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          
          console.log(`📊 Expecting ${shardCount} shards of ${(shardSize/1024/1024).toFixed(0)}MB each`);
          
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
          
          // Try File System Access API
          if ('showSaveFilePicker' in window) {
            try {
              fileHandle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'All Files', accept: {'*/*': []} }]
              });
              writableStream = await fileHandle.createWritable({ keepExistingData: false });
              useFileSystemAPI = true;
              console.log('✅ File System Access API active');
            } catch (err) {
              console.log('⚠️ File System Access API failed, using RAM');
              useFileSystemAPI = false;
            }
          }

          if (!useFileSystemAPI && supportsStreamSaver()) {
            try {
              streamSaver.mitm = '/streamsaver/mitm.html';
              const fileStream = streamSaver.createWriteStream(fileName, { size: fileSize });
              streamWriter = fileStream.getWriter();
              useStreamSaver = true;
              console.log('✅ StreamSaver enabled for receiver');
            } catch (error) {
              console.warn('⚠️ StreamSaver init failed, using in-memory fallback', error);
              useStreamSaver = false;
              streamWriter = null;
            }
          }

          if (!useFileSystemAPI && !useStreamSaver) {
            shardStates.forEach((state, id) => {
              if (!shardBuffers.has(id)) {
                shardBuffers.set(id, new Uint8Array(state.total));
                cachedShardBytes += state.total;
              }
            });
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
            connection: connInfo ? {
              effectiveType: typeof connInfo.effectiveType === 'string' ? connInfo.effectiveType : undefined,
              downlinkMbps: typeof connInfo.downlink === 'number' ? connInfo.downlink : undefined,
              rttMs: typeof connInfo.rtt === 'number' ? connInfo.rtt : undefined,
              saveData: typeof connInfo.saveData === 'boolean' ? connInfo.saveData : undefined
            } : undefined
          };

          conn.send({
            type: 'receiver_ready',
            receiverProfile,
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

          if (!useFileSystemAPI && !useStreamSaver) {
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
          console.log('✅ Transfer complete signal');

          completeSignalReceived = true;

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
    totalSize?: number
  ): Promise<Blob | void> => {
    const isSender = input !== null;
    
    if (isSender) {
      await sendFileMultiStream(conn, input, fileName, totalSize);
    } else {
      return await receiveFileMultiStream(conn);
    }
  }, [sendFileMultiStream, receiveFileMultiStream]);

  return {
    transferFileAdaptive,
    transferProgress,
    isTransferring
  };
};
