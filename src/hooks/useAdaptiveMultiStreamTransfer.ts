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

      console.log('🌐 Network detection:', { iceState, connectionState });

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
        // Create parallel channels (SENDER mode)
        const channels = await createParallelChannels(conn, streamCount, true);
        
        if (channels.length === 0) {
          throw new Error('Failed to create any parallel channels');
        }

        let bytesTransferred = 0;
        let lastSpeedCheck = Date.now();

        // Send metadata first on main connection
        conn.send({
          type: 'multi_stream_start',
          fileName: name,
          fileSize,
          streamCount: channels.length,
          timestamp: Date.now()
        });

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
    
    // Try to use File System Access API for progressive disk writes
    let fileHandle: any = null;
    let writableStream: any = null;
    let useFileSystemAPI = false;
    
    const chunks = new Map<number, Uint8Array>();
    let nextExpectedChunk = 0;

    return new Promise((resolve) => {
      // Listen on main connection for metadata
      const handleMainMessage = async (data: any) => {
        console.log('📨 Main connection message:', data.type);

        if (data.type === 'multi_stream_start') {
          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          fileName = data.fileName || 'download';
          console.log(`📊 Expecting ${(fileSize/1024/1024).toFixed(2)}MB across ${expectedStreams} streams`);
          
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
              writableStream = await fileHandle.createWritable();
              useFileSystemAPI = true;
              console.log('✅ File System Access API ACTIVE: Writing directly to disk');
            } catch (err) {
              console.error('⚠️ File System Access API failed:', err);
              console.log('Falling back to RAM buffer');
              useFileSystemAPI = false;
            }
          } else {
            console.log('📥 File System Access API NOT SUPPORTED, using RAM buffer');
          }
        } else if (data.type === 'multi_stream_complete') {
          console.log('✅ Transfer complete signal received');
        }
      };

      conn.on('data', handleMainMessage);

      // Listen for incoming DataChannels
      const pc = (conn as any).peerConnection;
      if (pc) {
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
                  // Chrome/Edge: Write directly to disk
                  if (chunkIndex === nextExpectedChunk) {
                    await writableStream.write(chunkData);
                    nextExpectedChunk++;
                    
                    // Write any buffered chunks that are now in order
                    while (chunks.has(nextExpectedChunk)) {
                      await writableStream.write(chunks.get(nextExpectedChunk)!);
                      chunks.delete(nextExpectedChunk);
                      nextExpectedChunk++;
                    }
                  } else {
                    // Out of order, buffer it
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
                  networkQuality: detectNetworkQuality(conn),
                  adaptiveChunkSize: 256 * 1024
                }));

                // Check if complete (based on bytes, not chunk count)
                if (bytesReceived >= fileSize && fileSize > 0) {
                  console.log(`🎉 All data received (${bytesReceived}/${fileSize} bytes)`);
                  
                  if (useFileSystemAPI && writableStream) {
                    // Chrome/Edge: Close the file stream
                    await writableStream.close();
                    console.log('✅ File written to disk');
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
          };
        };
      }
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
