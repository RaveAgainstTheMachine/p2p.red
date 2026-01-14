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
    setIsTransferring(true);
    startTime.current = Date.now();

    // Detect network quality
    const quality = detectNetworkQuality(conn);
    console.log(`🌐 Network quality: ${quality}`);

    // Determine optimal stream count based on network quality
    const streamCount = quality === 'excellent' ? 8 : quality === 'good' ? 4 : quality === 'fair' ? 2 : 1;
    
    // Get adaptive chunk size
    let chunkSize = getAdaptiveChunkSize(quality, 0);
    
    const fileSize = totalSize || (input as File).size;
    const name = fileName || (input as File).name;
    
    console.log(`🚀 ADAPTIVE MULTI-STREAM: ${streamCount} streams, ${chunkSize/1024}KB chunks, ${name}`);

    try {
      // Create parallel channels (SENDER mode)
      const channels = await createParallelChannels(conn, streamCount, true);
      
      if (channels.length === 0) {
        throw new Error('Failed to create any parallel channels');
      }

      const totalChunks = Math.ceil(fileSize / chunkSize);
      let bytesTransferred = 0;
      let lastSpeedCheck = Date.now();
      let lastBytesTransferred = 0;

      // Send metadata first on main connection
      conn.send({
        type: 'multi_stream_start',
        totalChunks,
        fileSize,
        streamCount: channels.length,
        timestamp: Date.now()
      });

      // Get stream reader
      const stream = input instanceof File ? input.stream() : input;
      const reader = stream.getReader();
      
      let chunkIndex = 0;
      let buffer = new Uint8Array(0);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done && buffer.length === 0) break;

        // Append to buffer
        if (value) {
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
        }

        // Process chunks from buffer
        while (buffer.length >= chunkSize || (done && buffer.length > 0)) {
          const chunkData = buffer.slice(0, Math.min(chunkSize, buffer.length));
          buffer = buffer.slice(chunkData.length);

          // Select channel (round-robin)
          const channelIndex = chunkIndex % channels.length;
          const channel = channels[channelIndex];

          // Check buffer before sending
          if (channel.bufferedAmount > 16 * 1024 * 1024) {
            // Wait for buffer to drain
            await new Promise(resolve => setTimeout(resolve, 10));
            continue;
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
          
          channel.send(message.buffer);

          bytesTransferred += chunkData.length;
          chunkIndex++;

          // Adaptive chunk size adjustment
          const now = Date.now();
          if (now - lastSpeedCheck > 1000) {
            const elapsed = (now - lastSpeedCheck) / 1000;
            const currentSpeed = (bytesTransferred - lastBytesTransferred) / elapsed;
            
            // Adjust chunk size based on current speed
            chunkSize = getAdaptiveChunkSize(quality, currentSpeed);
            
            lastSpeedCheck = now;
            lastBytesTransferred = bytesTransferred;

            // Update progress
            const totalElapsed = (now - startTime.current) / 1000;
            const avgSpeed = bytesTransferred / totalElapsed;
            const timeRemaining = avgSpeed > 0 ? (fileSize - bytesTransferred) / avgSpeed : 0;

            setTransferProgress({
              bytesTransferred,
              totalBytes: fileSize,
              percentage: (bytesTransferred / fileSize) * 100,
              speed: avgSpeed,
              timeRemaining,
              activeStreams: channels.length,
              networkQuality: quality,
              adaptiveChunkSize: chunkSize
            });

            console.log(`📤 ${(bytesTransferred/1024/1024).toFixed(1)}MB / ${(fileSize/1024/1024).toFixed(1)}MB @ ${(avgSpeed/1024/1024).toFixed(2)} MB/s, Chunk: ${chunkSize/1024}KB`);
          }

          if (buffer.length < chunkSize && !done) break;
        }

        if (done && buffer.length === 0) break;
      }

      // Send completion signal
      conn.send({
        type: 'multi_stream_complete',
        totalChunks: chunkIndex,
        fileSize,
        timestamp: Date.now()
      });

      // Close channels
      channels.forEach(ch => ch.close());

      console.log('🎉 MULTI-STREAM: Transfer completed');

    } finally {
      setIsTransferring(false);
    }
  }, [detectNetworkQuality, getAdaptiveChunkSize, createParallelChannels]);

  // Receive file with multi-stream
  const receiveFileMultiStream = useCallback(async (
    conn: DataConnection
  ): Promise<Blob> => {
    console.log('🚀 receiveFileMultiStream called');
    setIsTransferring(true);
    startTime.current = Date.now();

    const chunks = new Map<number, Uint8Array>();
    let totalChunks = 0;
    let fileSize = 0;
    let bytesReceived = 0;
    let expectedStreams = 0;

    return new Promise((resolve) => {
      // Listen on main connection for metadata
      const handleMainMessage = (data: any) => {
        console.log('📨 Main connection message:', data.type);

        if (data.type === 'multi_stream_start') {
          totalChunks = data.totalChunks;
          fileSize = data.fileSize;
          expectedStreams = data.streamCount;
          console.log(`📊 Expecting ${totalChunks} chunks across ${expectedStreams} streams, total: ${(fileSize/1024/1024).toFixed(2)}MB`);
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

          channel.onmessage = (event) => {
            try {
              if (event.data instanceof ArrayBuffer) {
                // Parse binary message with header
                const message = new Uint8Array(event.data);
                
                // Extract chunk index from first 8 bytes
                const headerView = new DataView(event.data, 0, 8);
                const chunkIndex = headerView.getUint32(0, true);
                
                // Extract chunk data (skip 8-byte header)
                const chunkData = message.slice(8);
                
                chunks.set(chunkIndex, chunkData);
                bytesReceived += chunkData.length;

                // Update progress
                const elapsed = (Date.now() - startTime.current) / 1000;
                const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
                const timeRemaining = speed > 0 ? (fileSize - bytesReceived) / speed : 0;

                setTransferProgress(prev => ({
                  ...prev,
                  bytesTransferred: bytesReceived,
                  totalBytes: fileSize,
                  percentage: fileSize > 0 ? (bytesReceived / fileSize) * 100 : 0,
                  speed,
                  timeRemaining
                }));

                // Check if complete
                if (chunks.size === totalChunks && totalChunks > 0) {
                  console.log('🎉 All chunks received, assembling file');
                  
                  // Reassemble file
                  const sortedChunks = Array.from(chunks.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([, data]) => data);

                  const blob = new Blob(sortedChunks as BlobPart[]);
                  setIsTransferring(false);
                  conn.off('data', handleMainMessage);
                  resolve(blob);
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
    input: File | ReadableStream,
    isSender: boolean,
    fileName?: string,
    fileSize?: number
  ): Promise<Blob | void> => {
    console.log('🎯 transferFileAdaptive called:', { 
      isSender, 
      inputType: input?.constructor?.name,
      fileName: fileName || (input as File)?.name,
      fileSize: fileSize || (input as File)?.size
    });
    
    if (isSender) {
      await sendFileMultiStream(conn, input, fileName, fileSize);
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
