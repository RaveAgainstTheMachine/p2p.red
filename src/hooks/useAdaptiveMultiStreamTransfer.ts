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

  // Detect network quality from ICE candidates
  const detectNetworkQuality = useCallback((conn: DataConnection): 'excellent' | 'good' | 'fair' | 'poor' => {
    try {
      const pc = (conn as any).peerConnection;
      if (!pc) return 'good';

      // Check ICE connection state
      const iceState = pc.iceConnectionState;
      const connectionState = pc.connectionState;

      // Network detection (called frequently, don't log)

      // Excellent: Direct connection (host or srflx)
      if (iceState === 'connected' && connectionState === 'connected') {
        return 'excellent';
      }

      // Good: Stable connection
      if (iceState === 'completed') {
        return 'good';
      }

      // Fair: Using relay
      if (iceState === 'connected') {
        return 'fair';
      }

      return 'poor';
    } catch (error) {
      console.warn('Network quality detection failed:', error);
      return 'good';
    }
  }, []);

  // Adaptive chunk size based on network quality
  const getAdaptiveChunkSize = useCallback((quality: string, currentSpeed: number): number => {
    // Dynamic chunk sizing based on network quality and current speed
    if (quality === 'excellent' && currentSpeed > 10 * 1024 * 1024) {
      return 2 * 1024 * 1024; // 2MB for excellent connections with high speed
    } else if (quality === 'excellent') {
      return 1024 * 1024; // 1MB for excellent connections
    } else if (quality === 'good') {
      return 512 * 1024; // 512KB for good connections
    } else if (quality === 'fair') {
      return 256 * 1024; // 256KB for fair connections
    } else {
      return 128 * 1024; // 128KB for poor connections
    }
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

  // Send any stream (File or ReadableStream) with multi-stream parallel transfer
  const sendFileMultiStream = useCallback(async (
    conn: DataConnection,
    input: File | ReadableStream,
    fileName?: string,
    totalSize?: number
  ): Promise<void> => {
    console.log('🚀 sendFileMultiStream STARTED');
    return new Promise<void>(async (resolve, reject) => {
      console.log('📦 Promise wrapper created, setting up transfer...');
      setIsTransferring(true);
      startTime.current = Date.now();

      // Detect network quality
      const quality = detectNetworkQuality(conn);
      console.log(`🌐 Network quality: ${quality}`);

      // Determine optimal stream count based on network quality
      const streamCount = quality === 'excellent' ? 8 : quality === 'good' ? 4 : quality === 'fair' ? 2 : 1;
      
      // Get adaptive chunk size (initial)
      // Chrome DataChannel max message size: 262,144 bytes
      // With 8-byte header, max chunk data: 262,136 bytes
      const chunkSize = 262136; // Max chunk size to fit in DataChannel message limit
      
      const fileSize = totalSize || (input as File).size;
      const name = fileName || (input as File).name;
      
      console.log(`🚀 ADAPTIVE MULTI-STREAM: ${streamCount} streams, ${chunkSize/1024}KB chunks, ${name}`);

      try {
        // Calculate SHA-256 hash of file for integrity verification (only for File objects)
        let fileHash = '';
        if (input instanceof File) {
          console.log('🔐 Calculating file hash for integrity verification...');
          const hashBuffer = await crypto.subtle.digest('SHA-256', await input.arrayBuffer());
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          console.log(`✅ File hash (SHA-256): ${fileHash}`);
        } else {
          console.log('⚠️ Skipping hash calculation for ReadableStream (ZIP folder)');
        }

        // Send metadata first and wait for receiver to be ready
        console.log('📤 Sending metadata and waiting for receiver ready signal...');
        conn.send({
          type: 'multi_stream_start',
          fileName: name,
          fileSize,
          streamCount,
          fileHash: fileHash || undefined,
          timestamp: Date.now()
        });

        // Wait for receiver ready signal
        await new Promise<void>((resolveReady) => {
          const readyHandler = (data: any) => {
            if (data.type === 'receiver_ready') {
              console.log('✅ Receiver ready signal received, starting transfer...');
              conn.off('data', readyHandler);
              resolveReady();
            }
          };
          conn.on('data', readyHandler);
        });

        // NOW create parallel channels (SENDER mode)
        console.log('🔧 Creating DataChannels...');
        const channels = await createParallelChannels(conn, streamCount, true);
        
        if (channels.length === 0) {
          throw new Error('Failed to create any parallel channels');
        }

        let bytesTransferred = 0;
        let lastSpeedCheck = Date.now();

        // Get stream reader
        const stream = input instanceof File ? input.stream() : input;
        const reader = stream.getReader();
        
        let chunkIndex = 0;
        let buffer = new Uint8Array(0);
        let isPaused = false;
        
        // Set up event-driven flow control for each channel
        const HIGH_WATER_MARK = 1 * 1024 * 1024; // 1MB - pause sending
        const LOW_WATER_MARK = 256 * 1024; // 256KB - resume sending
        
        channels.forEach(channel => {
          channel.bufferedAmountLowThreshold = LOW_WATER_MARK;
          channel.addEventListener('bufferedamountlow', () => {
            if (isPaused) {
              isPaused = false;
              console.log('📤 Buffer drained, resuming send');
              processNextChunk();
            }
          });
        });
        
        let streamDone = false;
        
        const processNextChunk = async () => {
          while (!isPaused && !streamDone) {
            // Read more data if buffer is low
            if (buffer.length < chunkSize) {
              const { done, value } = await reader.read();
              
              if (value) {
                const newBuffer = new Uint8Array(buffer.length + value.length);
                newBuffer.set(buffer);
                newBuffer.set(value, buffer.length);
                buffer = newBuffer;
              }
              
              if (done) {
                streamDone = true;
                if (buffer.length === 0) {
                  // All data sent, close connection
                  conn.send({
                    type: 'multi_stream_complete',
                    bytesTransferred,
                    fileSize,
                    timestamp: Date.now()
                  });
                  channels.forEach(ch => ch.close());
                  console.log('🎉 MULTI-STREAM: Transfer completed - RESOLVING PROMISE');
                  setIsTransferring(false);
                  resolve();
                  return;
                }
              }
            }
            
            // Process one chunk
            if (buffer.length > 0) {
              const chunkData = buffer.slice(0, Math.min(chunkSize, buffer.length));
              buffer = buffer.slice(chunkData.length);

              // Select channel (round-robin)
              const channelIndex = chunkIndex % channels.length;
              const channel = channels[channelIndex];

              // Check if we need to pause (high water mark)
              if (channel.bufferedAmount > HIGH_WATER_MARK) {
                isPaused = true;
                console.log(`⏸️ Buffer high (${(channel.bufferedAmount/1024/1024).toFixed(1)}MB), pausing send`);
                return; // Will resume via bufferedamountlow event
              }

              // Send chunk as single binary message with header
              // Header: 8 bytes for chunkIndex (uint32 x2 for 64-bit support)
              const header = new ArrayBuffer(8);
              const headerView = new DataView(header);
              headerView.setUint32(0, chunkIndex, true); // Low 32 bits
              headerView.setUint32(4, 0, true); // High 32 bits (for future large files)
              
              // Combine header + chunk data into single message
              const message = new Uint8Array(8 + chunkData.length);
              message.set(new Uint8Array(header), 0);
              message.set(chunkData, 8);
              
              const bytesSent = message.buffer.byteLength;
              channel.send(message.buffer);
              chunkIndex++;
              bytesTransferred += bytesSent;

              // Update progress
              const now = Date.now();
              if (now - lastSpeedCheck > 1000) {
                lastSpeedCheck = now;
                
                // Calculate actual bytes sent (not just buffered)
                const totalBuffered = channels.reduce((sum, ch) => sum + ch.bufferedAmount, 0);
                const actualBytesSent = bytesTransferred - totalBuffered;

                // Update progress based on actual sent bytes
                const totalElapsed = (now - startTime.current) / 1000;
                const avgSpeed = actualBytesSent / totalElapsed;
                const timeRemaining = avgSpeed > 0 ? (fileSize - actualBytesSent) / avgSpeed : 0;
                
                console.log(`📊 Sender: ${(actualBytesSent/1024/1024).toFixed(1)}MB sent, ${(totalBuffered/1024/1024).toFixed(1)}MB buffered, ${(bytesTransferred/1024/1024).toFixed(1)}MB total queued`);

                setTransferProgress({
                  bytesTransferred: actualBytesSent,
                  totalBytes: fileSize,
                  percentage: (actualBytesSent / fileSize) * 100,
                  speed: avgSpeed,
                  timeRemaining,
                  activeStreams: channels.length,
                  networkQuality: quality,
                  adaptiveChunkSize: chunkSize
                });
              }
            }
          }
        };
      
        // Start processing (don't await - it will pause and resume via events)
        console.log('⚡ Starting processNextChunk...');
        processNextChunk().catch((error) => {
          console.error('❌ sendFileMultiStream ERROR:', error);
          setIsTransferring(false);
          reject(error);
        });
      } catch (error) {
        console.error('❌ sendFileMultiStream SETUP ERROR:', error);
        setIsTransferring(false);
        reject(error);
      }
    });
  }, [detectNetworkQuality, getAdaptiveChunkSize, createParallelChannels]);

  // Receive file with multi-stream
  const receiveFileMultiStream = useCallback(async (
    conn: DataConnection
  ): Promise<Blob> => {
    console.log('🚀 receiveFileMultiStream called');
    setIsTransferring(true);
    startTime.current = Date.now();

    let fileSize = 0;
    let bytesReceived = 0;
    let expectedStreams = 0;
    let fileName = 'download';
    let expectedHash = '';
    
    // Try to use File System Access API for progressive disk writes
    let fileHandle: any = null;
    let writableStream: any = null;
    let useFileSystemAPI = false;
    
    const chunks = new Map<number, Uint8Array>();
    const CHUNK_SIZE = 262136; // Must match sender chunk size

    return new Promise((resolve) => {
      // Setup DataChannel handler factory (will be called after File System Access API)
      const setupDataChannelHandlers = () => {
        const pc = (conn as any).peerConnection;
        if (pc) {
          console.log('🔧 Setting up DataChannel handlers with useFileSystemAPI:', useFileSystemAPI);
          pc.ondatachannel = (event: RTCDataChannelEvent) => {
            const channel = event.channel;
            console.log(`📥 Incoming DataChannel: ${channel.label}`);

            channel.onmessage = async (event) => {
              try {
                if (event.data instanceof ArrayBuffer) {
                  // Parse binary message with header
                  const message = new Uint8Array(event.data);
                  
                  // Extract chunk index from first 8 bytes
                  const headerView = new DataView(event.data, 0, 8);
                  const chunkIndex = headerView.getUint32(0, true);
                  
                  // Extract chunk data (skip 8-byte header)
                  const chunkData = message.slice(8);
                  
                  bytesReceived += chunkData.length;
                  
                  if (useFileSystemAPI && writableStream) {
                    // Chrome/Edge: Write directly to disk at correct position
                    try {
                      // Calculate file position for this chunk
                      const position = chunkIndex * CHUNK_SIZE;
                      
                      // Write with position parameter (File System Access API)
                      await writableStream.write({
                        type: 'write',
                        position: position,
                        data: chunkData
                      });
                      
                      if (chunkIndex % 100 === 0) {
                        console.log(`💾 Wrote chunk ${chunkIndex} to disk at position ${position} (${chunkData.length} bytes)`);
                      }
                    } catch (error) {
                      console.error(`❌ DISK WRITE FAILED for chunk ${chunkIndex}:`, error);
                      // Fall back to RAM on write error
                      chunks.set(chunkIndex, chunkData);
                    }
                  } else {
                    // Firefox: Buffer in RAM for traditional download
                    chunks.set(chunkIndex, chunkData);
                  }

                  // Update progress
                  const now = Date.now();
                  const elapsed = (now - startTime.current) / 1000;
                  const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
                  const timeRemaining = speed > 0 ? (fileSize - bytesReceived) / speed : 0;

                  setTransferProgress(prev => ({
                    ...prev,
                    bytesTransferred: bytesReceived,
                    totalBytes: fileSize,
                    percentage: fileSize > 0 ? (bytesReceived / fileSize) * 100 : 0,
                    speed,
                    timeRemaining,
                    activeStreams: expectedStreams,
                    networkQuality: prev.networkQuality || 'good',
                    adaptiveChunkSize: 256 * 1024
                  }));

                  // Check if complete (based on bytes, not chunk count)
                  if (bytesReceived >= fileSize && fileSize > 0) {
                    console.log(`🎉 All data received (${bytesReceived}/${fileSize} bytes)`);
                    
                    if (useFileSystemAPI && writableStream) {
                      // Chrome/Edge: Close the file stream and verify hash
                      await writableStream.close();
                      console.log('✅ File written to disk');
                      
                      // Verify file integrity if hash was provided
                      if (expectedHash && fileHandle) {
                        console.log('🔐 Verifying file integrity...');
                        try {
                          const file = await fileHandle.getFile();
                          const receivedHashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                          const receivedHashArray = Array.from(new Uint8Array(receivedHashBuffer));
                          const receivedHash = receivedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                          
                          if (receivedHash === expectedHash) {
                            console.log('✅ File integrity verified - hashes match!');
                            console.log(`   Expected: ${expectedHash}`);
                            console.log(`   Received: ${receivedHash}`);
                          } else {
                            console.error('❌ FILE CORRUPTION DETECTED - hashes do not match!');
                            console.error(`   Expected: ${expectedHash}`);
                            console.error(`   Received: ${receivedHash}`);
                            alert('⚠️ File transfer completed but integrity check FAILED!\n\nThe received file is corrupted and may not match the original.\n\nPlease try the transfer again.');
                          }
                        } catch (hashError) {
                          console.error('⚠️ Failed to verify file hash:', hashError);
                        }
                      }
                      
                      setIsTransferring(false);
                      conn.off('data', handleMainMessage);
                      // Return empty blob since file is already on disk
                      resolve(new Blob([]));
                    } else {
                      // Firefox: Assemble from RAM and trigger traditional download
                      console.log(`📥 Firefox fallback: Assembling ${chunks.size} chunks from RAM`);
                      const sortedChunks = Array.from(chunks.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([, data]) => data);

                      // Calculate total size and combine chunks
                      const totalSize = sortedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
                      const combined = new Uint8Array(totalSize);
                      let offset = 0;
                      
                      for (const chunk of sortedChunks) {
                        combined.set(chunk, offset);
                        offset += chunk.length;
                      }
                      
                      const blob = new Blob([combined], { type: 'application/octet-stream' });
                      
                      // Trigger automatic download (Firefox traditional method)
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      
                      console.log('📥 Traditional download triggered for:', fileName);
                      setIsTransferring(false);
                      conn.off('data', handleMainMessage);
                      resolve(blob);
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to parse chunk:', error);
              }
            }; // End channel.onmessage
          }; // End pc.ondatachannel
        } // End if (pc)
      }; // End setupDataChannelHandlers

      // Listen on main connection for metadata
      const handleMainMessage = async (data: any) => {
        console.log('📨 Main connection message:', data.type);

        if (data.type === 'multi_stream_start') {
          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          fileName = data.fileName || 'download';
          expectedHash = data.fileHash || '';
          console.log(`📊 Expecting ${(fileSize/1024/1024).toFixed(2)}MB across ${expectedStreams} streams`);
          if (expectedHash) {
            console.log(`🔐 Expected file hash (SHA-256): ${expectedHash}`);
          }
          
          // Prompt for save location NOW (before chunks arrive)
          console.log('🔍 Checking for File System Access API support...');
          console.log('showSaveFilePicker available:', 'showSaveFilePicker' in window);
          
          if ('showSaveFilePicker' in window) {
            try {
              console.log('📁 PROMPTING USER for save location...');
              fileHandle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                  description: 'All Files',
                  accept: {'*/*': []}
                }]
              });
              console.log('✅ User selected save location:', fileHandle);
              writableStream = await fileHandle.createWritable({ keepExistingData: false });
              useFileSystemAPI = true;
              console.log('✅ File System Access API ACTIVE: Writing directly to disk');
            } catch (err: any) {
              console.error('⚠️ File System Access API failed:', err);
              if (err.name === 'AbortError') {
                console.log('❌ User CANCELLED save dialog - falling back to RAM buffer');
              } else {
                console.log('❌ File System Access API error:', err.name, err.message);
              }
              console.log('Falling back to RAM buffer');
              useFileSystemAPI = false;
            }
          } else {
            console.log('📥 File System Access API NOT SUPPORTED, using RAM buffer');
          }
          
          // Check if RAM fallback is safe
          if (!useFileSystemAPI) {
            const fileSizeMB = fileSize / (1024 * 1024);
            const fileSizeGB = fileSize / (1024 * 1024 * 1024);
            
            // Get available memory (if supported)
            let availableMemoryMB = 0;
            if ('memory' in performance && (performance as any).memory) {
              const memory = (performance as any).memory;
              availableMemoryMB = (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / (1024 * 1024);
              console.log(`💾 Available RAM: ${availableMemoryMB.toFixed(0)}MB, File size: ${fileSizeMB.toFixed(0)}MB`);
            }
            
            // Warn if file is large
            if (fileSizeGB > 2) {
              const proceed = confirm(
                `⚠️ WARNING: Large file (${fileSizeGB.toFixed(2)}GB) will be buffered in RAM!\n\n` +
                `This may cause your browser to crash or freeze.\n\n` +
                `Recommended: Use Chrome/Edge for direct disk writing.\n\n` +
                `Continue anyway?`
              );
              if (!proceed) {
                console.log('❌ User aborted RAM fallback for large file');
                setIsTransferring(false);
                return;
              }
            } else if (availableMemoryMB > 0 && fileSizeMB > availableMemoryMB * 0.8) {
              const proceed = confirm(
                `⚠️ WARNING: File (${fileSizeMB.toFixed(0)}MB) may exceed available RAM (${availableMemoryMB.toFixed(0)}MB)!\n\n` +
                `This may cause your browser to crash.\n\n` +
                `Continue anyway?`
              );
              if (!proceed) {
                console.log('❌ User aborted RAM fallback due to insufficient memory');
                setIsTransferring(false);
                return;
              }
            }
            
            console.log('✅ RAM fallback check passed, proceeding with buffer');
          }
          
          // NOW setup DataChannel handlers with correct useFileSystemAPI value
          setupDataChannelHandlers();
          
          // Send ready signal to sender
          console.log('📤 Sending receiver_ready signal to sender...');
          conn.send({
            type: 'receiver_ready',
            timestamp: Date.now()
          });
        } else if (data.type === 'multi_stream_complete') {
          console.log('✅ Transfer complete signal received');
        }
      };

      conn.on('data', handleMainMessage);
    });
  }, []);

  // Main transfer function - handles File or ReadableStream
  const transferFileAdaptive = useCallback(async (
    conn: DataConnection,
    input: File | ReadableStream | null,
    fileName?: string,
    fileSize?: number
  ): Promise<Blob | void> => {
    // Auto-detect: if input is provided, we're sending; if null, we're receiving
    const isSender = input !== null;
    
    console.log('🎯 transferFileAdaptive called:', { 
      isSender, 
      inputType: input?.constructor?.name,
      fileName: fileName || (input as File)?.name,
      fileSize: fileSize || (input as File)?.size
    });
    
    if (isSender) {
      await sendFileMultiStream(conn, input!, fileName, fileSize);
    } else {
      console.log('📥 Starting multi-stream receiver');
      return await receiveFileMultiStream(conn);
    }
  }, [sendFileMultiStream, receiveFileMultiStream]);

  return {
    transferProgress,
    isTransferring,
    transferFileAdaptive
  };
};
