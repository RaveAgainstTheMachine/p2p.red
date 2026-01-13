import { useState, useRef } from 'react';
import { DataConnection } from 'peerjs';

interface TrueP2PProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  senderSpeed: number;
  receiverSpeed: number;
  synchronizedSpeed: number;
  speed: number; // For compatibility with TransferProgress
  timeRemaining: number; // For compatibility with TransferProgress
}

export const useBrowserNativeP2P = () => {
  const [transferProgress, setTransferProgress] = useState<TrueP2PProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    senderSpeed: 0,
    receiverSpeed: 0,
    synchronizedSpeed: 0,
    speed: 0, // For compatibility
    timeRemaining: 0 // For compatibility
  });

  const [isTransferring, setIsTransferring] = useState(false);
  
  // TRUE P2P: Browser-native synchronization
  const transferState = useRef({
    senderActive: false,
    receiverActive: false,
    currentChunk: 0,
    totalChunks: 0,
    chunkSize: 32 * 1024, // 32KB for perfect sync
    startTime: 0,
    lastSenderTime: 0,
    lastReceiverTime: 0
  });

  // TRUE P2P: Measure actual WebRTC transfer speed
  const measureActualSpeed = (bytes: number, startTime: number): number => {
    const elapsed = (Date.now() - startTime) / 1000;
    return elapsed > 0 ? bytes / elapsed : 0;
  };

  // TRUE P2P: Send with receiver-controlled pacing
  const sendWithReceiverPacing = async (conn: DataConnection, file: File): Promise<void> => {
    const state = transferState.current;
    state.senderActive = true;
    state.startTime = Date.now();
    state.totalChunks = Math.ceil(file.size / state.chunkSize);
    
    console.log(`🎯 BROWSER P2P: Starting ${state.totalChunks} chunks of ${state.chunkSize/1024}KB`);

    try {
      const fileBuffer = await file.arrayBuffer();
      
      for (let chunkIndex = 0; chunkIndex < state.totalChunks; chunkIndex++) {
        state.currentChunk = chunkIndex;
        
        // Wait for receiver to be ready (true P2P sync)
        await waitForReceiverReady(conn, chunkIndex);
        
        // Send chunk
        const start = chunkIndex * state.chunkSize;
        const end = Math.min(start + state.chunkSize, file.size);
        const chunk = fileBuffer.slice(start, end);
        
        // Measure and send
        const sendStart = Date.now();
        conn.send({
          type: 'p2p_chunk',
          chunkIndex,
          data: chunk,
          sendTime: sendStart
        });
        
        state.lastSenderTime = Date.now();
        
        // Update sender speed
        const senderSpeed = measureActualSpeed(
          (chunkIndex + 1) * state.chunkSize,
          state.startTime
        );
        
        // Update progress with both speeds
        const bytesTransferred = (chunkIndex + 1) * chunk.byteLength;
        setTransferProgress(prev => ({
          ...prev,
          bytesTransferred,
          totalBytes: file.size,
          percentage: (bytesTransferred / file.size) * 100,
          senderSpeed,
          speed: senderSpeed, // Compatibility
          timeRemaining: senderSpeed > 0 ? (file.size - bytesTransferred) / senderSpeed : 0 // Compatibility
        }));
        
        console.log(`📤 BROWSER P2P: Sent chunk ${chunkIndex}, sender speed: ${(senderSpeed/1024/1024).toFixed(2)} MB/s`);
      }
      
    } finally {
      state.senderActive = false;
    }
  };

  // TRUE P2P: Wait for receiver to signal readiness
  const waitForReceiverReady = (conn: DataConnection, chunkIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      const checkReady = () => {
        // Send "ready to send" ping
        conn.send({
          type: 'sender_ready',
          chunkIndex,
          timestamp: Date.now()
        });
      };

      const handleResponse = (data: any) => {
        if (data.type === 'receiver_ready' && data.chunkIndex === chunkIndex) {
          conn.off('data', handleResponse);
          console.log(`✅ BROWSER P2P: Receiver ready for chunk ${chunkIndex}`);
          resolve();
        }
      };

      conn.on('data', handleResponse);
      checkReady(); // Start the handshake
      
      // Timeout after 5 seconds
      setTimeout(() => {
        conn.off('data', handleResponse);
        console.warn(`⚠️ BROWSER P2P: Receiver not ready for chunk ${chunkIndex}, proceeding anyway`);
        resolve();
      }, 5000);
    });
  };

  // TRUE P2P: Receive with sender synchronization
  const receiveWithSenderSync = async (conn: DataConnection): Promise<Blob> => {
    const state = transferState.current;
    state.receiverActive = true;
    state.startTime = Date.now();
    
    const chunks: ArrayBuffer[] = [];
    let totalBytes = 0;
    let expectedChunks = 0;

    return new Promise((resolve) => {
      const handleMessage = async (data: any) => {
        const now = Date.now();
        
        if (data.type === 'sender_ready') {
          // Sender is ready to send, signal receiver readiness
          conn.send({
            type: 'receiver_ready',
            chunkIndex: data.chunkIndex,
            timestamp: now
          });
          
          console.log(`📥 BROWSER P2P: Receiver ready for chunk ${data.chunkIndex}`);
          
        } else if (data.type === 'p2p_chunk') {
          // Process chunk immediately
          chunks[data.chunkIndex] = data.data;
          totalBytes += data.data.byteLength;
          
          // Calculate network transfer speed (actual WebRTC speed)
          const networkLatency = now - data.sendTime;
          const actualTransferSpeed = data.data.byteLength / (networkLatency / 1000);
          
          // Calculate receiver processing speed
          const receiverSpeed = measureActualSpeed(totalBytes, state.startTime);
          
          // Update progress with both speeds
          setTransferProgress(prev => ({
            ...prev,
            bytesTransferred: totalBytes,
            receiverSpeed,
            synchronizedSpeed: actualTransferSpeed, // This should match sender
            speed: receiverSpeed, // Compatibility
            timeRemaining: receiverSpeed > 0 ? (prev.totalBytes - totalBytes) / receiverSpeed : 0 // Compatibility
          }));
          
          console.log(`📥 BROWSER P2P: Received chunk ${data.chunkIndex}, network speed: ${(actualTransferSpeed/1024/1024).toFixed(2)} MB/s, receiver speed: ${(receiverSpeed/1024/1024).toFixed(2)} MB/s`);
          
          // Signal completion if this was the last chunk
          if (data.chunkIndex === expectedChunks - 1) {
            const blob = new Blob(chunks);
            setIsTransferring(false);
            conn.off('data', handleMessage);
            resolve(blob);
          }
          
        } else if (data.type === 'p2p_complete') {
          expectedChunks = data.totalChunks;
          console.log(`📊 BROWSER P2P: Expecting ${expectedChunks} chunks`);
        }
      };

      conn.on('data', handleMessage);
    });
  };

  // TRUE P2P: Main transfer function
  const transferFileBrowserP2P = async (
    conn: DataConnection, 
    file: File, 
    isSender: boolean
  ): Promise<Blob | void> => {
    setIsTransferring(true);
    
    try {
      if (isSender) {
        // Send total chunks info first
        const totalChunks = Math.ceil(file.size / transferState.current.chunkSize);
        conn.send({
          type: 'p2p_complete',
          totalChunks,
          fileSize: file.size
        });
        
        await sendWithReceiverPacing(conn, file);
      } else {
        const blob = await receiveWithSenderSync(conn);
        return blob;
      }
    } finally {
      setIsTransferring(false);
    }
  };

  return {
    transferProgress,
    isTransferring,
    transferFileBrowserP2P
  };
};
