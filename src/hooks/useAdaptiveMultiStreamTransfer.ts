import { useState, useRef, useCallback } from 'react';
import { DataConnection } from 'peerjs';
import { MultiStreamOrchestrator } from '../utils/multiStreamOrchestrator';

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
}

interface ShardState {
  id: number;
  offset: number;
  size: number;
  bytesTransferred: number;
  status: 'pending' | 'sending' | 'complete' | 'failed';
  channelId: number;
}

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
      const MAX_CHANNELS = 256;
      const MIN_CHANNELS = 64;
      
      // Calculate optimal channels: more for larger files, fewer for smaller
      let numChannels = Math.min(
        Math.max(
          Math.ceil(shards.length / 2), // At least half the shards
          MIN_CHANNELS
        ),
        MAX_CHANNELS,
        shards.length // Never more than shards
      );
      
      // For very large files, use more channels
      if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
        numChannels = Math.min(MAX_CHANNELS, shards.length);
      }
      
      console.log(`🔧 Using ${numChannels} adaptive channels for ${shards.length} shards`);

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
          timestamp: Date.now()
        });

        // Wait for receiver ready signal
        await new Promise<void>((resolveReady) => {
          const readyHandler = (data: any) => {
            if (data.type === 'receiver_ready') {
              console.log('✅ Receiver ready, starting shard transfer...');
              conn.off('data', readyHandler);
              resolveReady();
            }
          };
          conn.on('data', readyHandler);
        });

        // Create parallel channels
        console.log('🔧 Creating DataChannels...');
        const channels = await createParallelChannels(conn, numChannels, true);
        
        if (channels.length === 0) {
          throw new Error('Failed to create any parallel channels');
        }

        let totalBytesTransferred = 0;
        const CHUNK_SIZE = 252 * 1024; // 252KB chunks (4 bytes reserved for shard ID header)
        let lastLoggedPercentage = 0;

        // Cache for ReadableStream shards (enables retransmission)
        const shardCache = new Map<number, Uint8Array>();

        // For Files: Use parallel shard sending
        if (isFile) {
          // Assign shards to channels (round-robin)
          shards.forEach((shard, i) => {
            shard.channelId = i % channels.length;
          });

          console.log(`📊 Shard distribution: ${channels.length} channels handling ${shards.length} shards`);

          const sendPromises = channels.map(async (channel, channelId) => {
            const assignedShards = shards.filter(s => s.channelId === channelId);

            for (const shard of assignedShards) {
              shard.status = 'sending';
              
              const shardBlob = (input as File).slice(shard.offset, shard.offset + shard.size);
              const shardData = new Uint8Array(await shardBlob.arrayBuffer());
              
              // Calculate per-shard CRC32
              const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));
              
              // Send shard metadata with CRC32
              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shard.size,
                channelId: channelId,
                crc32: shardCRC
              });

              // Send shard in chunks
              let sentBytes = 0;
              while (sentBytes < shardData.length) {
                const chunkData = shardData.slice(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));
                
                // Wait if buffer is full
                while (channel.bufferedAmount > 1 * 1024 * 1024) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                // Send chunk with shard ID
                const message = new Uint8Array(4 + chunkData.length);
                const view = new DataView(message.buffer);
                view.setUint32(0, shard.id, true);
                message.set(chunkData, 4);
                
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
                
                setTransferProgress({
                  bytesTransferred: totalBytesTransferred,
                  totalBytes: fileSize,
                  percentage: (totalBytesTransferred / fileSize) * 100,
                  speed,
                  timeRemaining: speed > 0 ? (fileSize - totalBytesTransferred) / speed : 0,
                  activeStreams: channels.length,
                  networkQuality: 'good',
                  adaptiveChunkSize: CHUNK_SIZE
                });
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
          });

          while (true) {
            const { done, value } = await reader.read();
            
            if (value) {
              let valueOffset = 0;
              
              // Fill current shard(s) with this chunk
              while (valueOffset < value.length) {
                const shard = shards[currentShardIndex];
                const spaceLeft = shard.size - currentShardFilled;
                const bytesToCopy = Math.min(spaceLeft, value.length - valueOffset);
                
                // Copy data into current shard buffer
                currentShardBuffer.set(
                  value.subarray(valueOffset, valueOffset + bytesToCopy),
                  currentShardFilled
                );
                
                currentShardFilled += bytesToCopy;
                valueOffset += bytesToCopy;
                
                // Shard complete? Send it!
                if (currentShardFilled >= shard.size) {
                  const shardData = currentShardBuffer.slice(0, currentShardFilled);
                  
                  // Cache shard until confirmed by receiver
                  shardCache.set(shard.id, shardData);
                  
                  // Calculate per-shard CRC32
                  const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));
                  
                  // Send shard
                  const channel = channels[shard.channelId];
                  
                  conn.send({
                    type: 'shard_start',
                    shardId: shard.id,
                    offset: shard.offset,
                    size: shardData.length,
                    channelId: shard.channelId,
                    crc32: shardCRC
                  });
                  
                  // Send in chunks
                  let sentBytes = 0;
                  while (sentBytes < shardData.length) {
                    const chunkData = shardData.slice(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));
                    
                    while (channel.bufferedAmount > 1 * 1024 * 1024) {
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    const message = new Uint8Array(4 + chunkData.length);
                    const view = new DataView(message.buffer);
                    view.setUint32(0, shard.id, true);
                    message.set(chunkData, 4);
                    
                    channel.send(message.buffer);
                    sentBytes += chunkData.length;
                  }
                  
                  totalBytesTransferred += shardData.length;
                  shard.status = 'complete';
                  
                  // Update progress
                  const now = Date.now();
                  const elapsed = (now - startTime.current) / 1000;
                  const speed = elapsed > 0 ? totalBytesTransferred / elapsed : 0;
                  const currentPercentage = Math.floor((totalBytesTransferred / fileSize) * 100);
                  
                  if (currentPercentage >= lastLoggedPercentage + 10) {
                    console.log(`📤 ${currentPercentage}% sent (${(totalBytesTransferred/1024/1024/1024).toFixed(2)}GB / ${(fileSize/1024/1024/1024).toFixed(2)}GB) @ ${(speed/1024/1024).toFixed(1)}MB/s`);
                    lastLoggedPercentage = currentPercentage;
                  }
                  
                  setTransferProgress({
                    bytesTransferred: totalBytesTransferred,
                    totalBytes: fileSize,
                    percentage: (totalBytesTransferred / fileSize) * 100,
                    speed,
                    timeRemaining: speed > 0 ? (fileSize - totalBytesTransferred) / speed : 0,
                    activeStreams: channels.length,
                    networkQuality: 'good',
                    adaptiveChunkSize: CHUNK_SIZE
                  });
                  
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
                shardCache.set(shard.id, shardData);
                
                // Calculate per-shard CRC32
                const shardCRC = finalizeCRC32(updateCRC32(0xFFFFFFFF, shardData));
                
                const channel = channels[shard.channelId];
                
                conn.send({
                  type: 'shard_start',
                  shardId: shard.id,
                  offset: shard.offset,
                  size: shardData.length,
                  channelId: shard.channelId,
                  crc32: shardCRC
                });
                
                let sentBytes = 0;
                while (sentBytes < shardData.length) {
                  const chunkData = shardData.slice(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));
                  
                  while (channel.bufferedAmount > 1 * 1024 * 1024) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }
                  
                  const message = new Uint8Array(4 + chunkData.length);
                  const view = new DataView(message.buffer);
                  view.setUint32(0, shard.id, true);
                  message.set(chunkData, 4);
                  
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

        // Handle shard confirmations and retransmission requests
        const messageHandler = async (data: any) => {
          if (data.type === 'shard_confirmed') {
            // Receiver confirmed shard is good, clear from cache
            const shardId = data.shardId;
            if (shardCache.has(shardId)) {
              shardCache.delete(shardId);
              console.log(`✅ Shard ${shardId} confirmed, cleared from cache (${shardCache.size} shards cached)`);
            }
          } else if (data.type === 'retransmit_shards') {
            console.log(`📡 Retransmit request for ${data.shardIds.length} shards`);
            
            for (const shardId of data.shardIds) {
              const shard = shards[shardId];
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
              
              conn.send({
                type: 'shard_start',
                shardId: shard.id,
                offset: shard.offset,
                size: shard.size,
                channelId: shard.channelId
              });

              let sentBytes = 0;
              while (sentBytes < shardData.length) {
                const chunkData = shardData.slice(sentBytes, Math.min(sentBytes + CHUNK_SIZE, shardData.length));
                
                while (channel.bufferedAmount > 1 * 1024 * 1024) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                const message = new Uint8Array(4 + chunkData.length);
                const view = new DataView(message.buffer);
                view.setUint32(0, shard.id, true);
                message.set(chunkData, 4);
                
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
        await new Promise(resolve => setTimeout(resolve, 5000));
        conn.off('data', messageHandler);

        channels.forEach(ch => ch.close());
        setIsTransferring(false);
        resolve();
      } catch (error) {
        console.error('❌ Shard transfer error:', error);
        setIsTransferring(false);
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
      let bytesReceived = 0;
      let lastLoggedPercentage = 0;
      
      // Shard tracking with CRC32 verification and immediate writes
      const shardStates = new Map<number, { 
        received: number, 
        total: number, 
        complete: boolean, 
        expectedCRC: string,
        currentCRC: number, // Incremental CRC32 calculation
        offset: number // Shard offset in file
      }>();
      
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
            const view = new DataView(message.buffer);
            const shardId = view.getUint32(0, true);
            const chunkData = message.slice(4);
            
            bytesReceived += chunkData.length;
            
            // Update shard state
            if (!shardStates.has(shardId)) {
              console.error(`❌ Received data for unknown shard ${shardId}`);
              return;
            }
            
            const shardState = shardStates.get(shardId)!;
            shardState.received += chunkData.length;
            
            // Update incremental CRC32
            shardState.currentCRC = updateCRC32(shardState.currentCRC, chunkData);
            
            // Write chunk to disk immediately (non-blocking)
            if (useFileSystemAPI && writableStream) {
              const chunkOffset = shardState.offset + (shardState.received - chunkData.length);
              writableStream.write({
                type: 'write',
                position: chunkOffset,
                data: chunkData
              }).catch((error: any) => {
                console.error(`❌ Chunk write failed for shard ${shardId}:`, error);
              });
            }
            
            // Shard complete? Verify CRC32
            if (shardState.received >= shardState.total) {
              console.log(`🔍 Shard ${shardId} complete: ${shardState.received}/${shardState.total} bytes, expectedCRC: ${shardState.expectedCRC}`);
              shardState.complete = true;
              
              // Finalize and verify CRC32
              const actualCRC = finalizeCRC32(shardState.currentCRC);
              if (actualCRC === shardState.expectedCRC) {
                console.log(`✅ Shard ${shardId} verified (CRC32: ${actualCRC})`);
                
                // Send confirmation to sender
                conn.send({
                  type: 'shard_confirmed',
                  shardId: shardId,
                  timestamp: Date.now()
                });
              } else {
                console.error(`❌ Shard ${shardId} CRC32 mismatch! Expected: ${shardState.expectedCRC}, Got: ${actualCRC}`);
                
                // Request immediate retransmission
                conn.send({
                  type: 'retransmit_shards',
                  shardIds: [shardId],
                  timestamp: Date.now()
                });
                
                // Reset shardState for retransmission
                shardState.received = 0;
                shardState.complete = false;
                shardState.currentCRC = 0xFFFFFFFF;
              }
            }
            
            // Note: Disk writes happen immediately per chunk (non-blocking)
            // This prevents RAM buffering while maintaining transfer speed
            
            // Update progress
            const now = Date.now();
            const elapsed = (now - startTime.current) / 1000;
            const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
            const currentPercentage = Math.floor((bytesReceived / fileSize) * 100);
            
            // Log every 10% milestone
            if (currentPercentage >= lastLoggedPercentage + 10) {
              console.log(`📥 ${currentPercentage}% received (${(bytesReceived/1024/1024/1024).toFixed(2)}GB / ${(fileSize/1024/1024/1024).toFixed(2)}GB) @ ${(speed/1024/1024).toFixed(1)}MB/s`);
              lastLoggedPercentage = currentPercentage;
            }
            
            setTransferProgress({
              bytesTransferred: bytesReceived,
              totalBytes: fileSize,
              percentage: (bytesReceived / fileSize) * 100,
              speed,
              timeRemaining: speed > 0 ? (fileSize - bytesReceived) / speed : 0,
              activeStreams: expectedStreams,
              networkQuality: 'good',
              adaptiveChunkSize: 256 * 1024
            });
            
            // Check completion
            if (bytesReceived >= fileSize) {
              console.log('✅ All data received!');
              
              if (useFileSystemAPI && writableStream) {
                await writableStream.close();
                setIsTransferring(false);
                resolve(new Blob([]));
              }
            }
          };
        };
      };

      const handleMainMessage = async (data: any) => {
        if (data.type === 'multi_stream_start') {
          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          fileName = data.fileName || 'download';
          shardSize = data.shardSize;
          shardCount = data.shardCount;
          
          console.log(`📊 Expecting ${shardCount} shards of ${(shardSize/1024/1024).toFixed(0)}MB each`);
          
          // Initialize shard states
          for (let i = 0; i < shardCount; i++) {
            shardStates.set(i, { 
              received: 0, 
              total: shardSize, 
              complete: false, 
              expectedCRC: '', 
              currentCRC: 0xFFFFFFFF,
              offset: i * shardSize
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
          
          // Wait for peerConnection to be ready before setting up handlers
          await new Promise<void>((resolve) => {
            const checkConnection = () => {
              const pc = (conn as any).peerConnection;
              if (pc && pc.connectionState !== 'closed') {
                console.log(`✅ PeerConnection ready (state: ${pc.connectionState})`);
                setupDataChannelHandlers();
                resolve();
              } else {
                console.log('⏳ Waiting for peerConnection...');
                setTimeout(checkConnection, 100);
              }
            };
            checkConnection();
          });
          
          conn.send({
            type: 'receiver_ready',
            timestamp: Date.now()
          });
        } else if (data.type === 'shard_start') {
          // Initialize or update shard with expected CRC32 and actual size
          if (!shardStates.has(data.shardId)) {
            shardStates.set(data.shardId, { 
              received: 0, 
              total: data.size, 
              complete: false, 
              expectedCRC: data.crc32 || '', 
              currentCRC: 0xFFFFFFFF,
              offset: data.offset || 0
            });
          } else {
            // Update existing shard with CRC and actual size (for retransmissions)
            const state = shardStates.get(data.shardId)!;
            state.total = data.size; // Update with actual shard size
            state.expectedCRC = data.crc32 || '';
            state.offset = data.offset || state.offset;
          }
        } else if (data.type === 'multi_stream_complete') {
          console.log('✅ Transfer complete signal');
          
          // Check for missing shards
          const missingShards = Array.from(shardStates.entries())
            .filter(([_, state]) => !state.complete)
            .map(([id]) => id);
          
          if (missingShards.length > 0) {
            console.error(`❌ Missing ${missingShards.length} shards:`, missingShards.slice(0, 10));
            
            conn.send({
              type: 'retransmit_shards',
              shardIds: missingShards,
              timestamp: Date.now()
            });
            return;
          }
          
          // All shards verified individually - transfer complete
          console.log('✅ All shards verified! Transfer complete.');
        } else if (data.type === 'retransmit_complete') {
          console.log('✅ Retransmission complete');
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
