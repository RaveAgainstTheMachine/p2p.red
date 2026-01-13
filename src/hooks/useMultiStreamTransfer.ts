import { useState, useCallback, useRef } from 'react';

interface StreamConnection {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  streamId: number;
  isActive: boolean;
}

interface TransferStrategy {
  chunkSize: number;
  maxConnections: number;
  sendInterval: number;
  bufferThreshold: number;
}

interface MultiStreamChunkData {
  type: 'multi_stream_chunk';
  streamId: number;
  chunkIndex: number;
  data: Uint8Array;
  totalChunks: number;
  timestamp: number;
}

export const useMultiStreamTransfer = () => {
  const [activeConnections, setActiveConnections] = useState<StreamConnection[]>([]);
  const [transferStrategy, setTransferStrategy] = useState<TransferStrategy>({
    chunkSize: 256 * 1024, // Start with 256KB (SCTP buffer size)
    maxConnections: 4,
    sendInterval: 0,
    bufferThreshold: 64 * 1024 * 1024
  });
  
  const performanceMetrics = useRef({
    rtt: [] as number[],
    throughput: [] as number[],
    packetLoss: 0,
    lastOptimization: Date.now()
  });

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:p2p.red:3478' },
    { 
      urls: 'turn:p2p.red:3478',
      username: 'p2puser',
      credential: 'p2ppass'
    }
  ];

  const createOptimizedDataChannel = (pc: RTCPeerConnection, streamId: number): RTCDataChannel => {
    return pc.createDataChannel(`stream_${streamId}`, {
      ordered: false, // UDP-like behavior
      maxRetransmits: 0, // No retransmission for speed
      maxPacketLifeTime: 0, // No buffering
      protocol: 'p2p-transfer'
    });
  };

  const createStreamConnection = async (streamId: number): Promise<StreamConnection> => {
    const pc = new RTCPeerConnection({ iceServers });
    const dc = createOptimizedDataChannel(pc, streamId);
    
    // Setup connection monitoring
    dc.onbufferedamountlow = () => {
      performanceMetrics.current.throughput.push(Date.now());
    };

    dc.onerror = (error) => {
      console.error(`Stream ${streamId} error:`, error);
    };

    return {
      peerConnection: pc,
      dataChannel: dc,
      streamId,
      isActive: false
    };
  };

  const establishMultiStreamConnection = async (): Promise<StreamConnection[]> => {
    const connections: StreamConnection[] = [];
    
    for (let i = 0; i < transferStrategy.maxConnections; i++) {
      const conn = await createStreamConnection(i);
      connections.push(conn);
    }

    // Create offer for each connection
    await Promise.all(
      connections.map(async (conn) => {
        const offer = await conn.peerConnection.createOffer();
        await conn.peerConnection.setLocalDescription(offer);
        // Offers would be sent via signaling in real implementation
      })
    );

    // Send all offers via signaling (you'll need to integrate with your existing signaling)
    // This is a simplified version - you'd integrate with your useWebRTC hook
    
    setActiveConnections(connections);
    return connections;
  };

  const optimizeTransferStrategy = useCallback(() => {
    const metrics = performanceMetrics.current;
    const avgThroughput = metrics.throughput.length > 0 ? 
      metrics.throughput.length / ((Date.now() - metrics.lastOptimization) / 1000) : 0;

    let newStrategy = { ...transferStrategy };

    if (avgThroughput < 10 * 1024 * 1024) { // Less than 10MB/s
      // Conservative strategy for poor networks
      newStrategy = {
        chunkSize: 128 * 1024,
        maxConnections: 2,
        sendInterval: 5,
        bufferThreshold: 32 * 1024 * 1024
      };
    } else if (avgThroughput < 50 * 1024 * 1024) { // Less than 50MB/s
      // Balanced strategy
      newStrategy = {
        chunkSize: 512 * 1024,
        maxConnections: 4,
        sendInterval: 1,
        bufferThreshold: 64 * 1024 * 1024
      };
    } else {
      // Aggressive strategy for high-performance networks
      newStrategy = {
        chunkSize: 1024 * 1024,
        maxConnections: 8,
        sendInterval: 0,
        bufferThreshold: 128 * 1024 * 1024
      };
    }

    setTransferStrategy(newStrategy);
    metrics.lastOptimization = Date.now();
    
    return newStrategy;
  }, [transferStrategy]);

  const sendFileMultiStream = async (file: File, connections: StreamConnection[]) => {
    const strategy = optimizeTransferStrategy();
    const chunkSize = strategy.chunkSize;
    
    console.log(`Multi-stream transfer: ${connections.length} streams, ${chunkSize/1024}KB chunks`);

    const promises = connections.map(async (conn, streamIndex) => {
      const startByte = streamIndex * Math.ceil(file.size / connections.length);
      const endByte = Math.min((streamIndex + 1) * Math.ceil(file.size / connections.length), file.size);
      const streamChunk = file.slice(startByte, endByte);
      
      return sendStreamChunk(conn, streamChunk, streamIndex, strategy);
    });

    return Promise.all(promises);
  };

  const sendStreamChunk = async (
    connection: StreamConnection, 
    chunk: Blob, 
    streamIndex: number, 
    strategy: TransferStrategy
  ) => {
    const reader = new FileReader();
    const chunkSize = strategy.chunkSize;
    let offset = 0;
    let chunkIndex = 0;

    return new Promise<void>((resolve, reject) => {
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        
        while (offset < data.length) {
          // Check buffer before sending
          if (connection.dataChannel.bufferedAmount > strategy.bufferThreshold) {
            await new Promise(res => {
              const checkBuffer = setInterval(() => {
                if (connection.dataChannel.bufferedAmount < strategy.bufferThreshold / 2) {
                  clearInterval(checkBuffer);
                  res(undefined);
                }
              }, 5);
            });
          }

          const end = Math.min(offset + chunkSize, data.length);
          const chunkBytes = data.slice(offset, end);
          
          try {
            const chunkPayload: MultiStreamChunkData = {
              type: 'multi_stream_chunk',
              streamId: streamIndex,
              chunkIndex: chunkIndex++,
              data: chunkBytes,
              totalChunks: Math.ceil(data.length / chunkSize),
              timestamp: Date.now()
            };
            
            connection.dataChannel.send(JSON.stringify(chunkPayload));

            // Performance monitoring
            performanceMetrics.current.throughput.push(Date.now());

            // Adaptive send interval
            if (strategy.sendInterval > 0) {
              await new Promise(res => setTimeout(res, strategy.sendInterval));
            }

            offset = end;
          } catch (error) {
            console.error(`Failed to send chunk ${chunkIndex} on stream ${streamIndex}:`, error);
            reject(error);
            return;
          }
        }
        
        resolve();
      };

      reader.onerror = () => reject(new Error('Failed to read file chunk'));
      reader.readAsArrayBuffer(chunk);
    });
  };

  const closeAllConnections = useCallback(() => {
    activeConnections.forEach(conn => {
      conn.dataChannel.close();
      conn.peerConnection.close();
    });
    setActiveConnections([]);
  }, [activeConnections]);

  return {
    activeConnections,
    transferStrategy,
    establishMultiStreamConnection,
    sendFileMultiStream,
    optimizeTransferStrategy,
    closeAllConnections,
    performanceMetrics: performanceMetrics.current
  };
};
