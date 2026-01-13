import { useState, useRef } from 'react';
import { DataConnection } from 'peerjs';

interface SpeedTransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
}

export const useMaximumSpeedTransfer = () => {
  const [transferProgress, setTransferProgress] = useState<SpeedTransferProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0
  });

  const [isTransferring, setIsTransferring] = useState(false);
  const startTime = useRef<number>(0);

  // MAXIMUM SPEED: Aggressive single-channel transfer
  const sendFileMaximumSpeed = async (conn: DataConnection, file: File): Promise<void> => {
    setIsTransferring(true);
    startTime.current = Date.now();
    
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for maximum speed
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    console.log(`🚀 MAXIMUM SPEED: ${totalChunks} chunks of ${CHUNK_SIZE/1024/1024}MB each`);
    
    try {
      const fileBuffer = await file.arrayBuffer();
      
      // Send chunks as fast as possible (no waiting)
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = fileBuffer.slice(start, end);
        
        // Send immediately for maximum speed
        conn.send({
          type: 'speed_chunk',
          chunkIndex: i,
          data: chunk,
          timestamp: Date.now()
        });
        
        // Update progress
        const bytesTransferred = (i + 1) * chunk.byteLength;
        const elapsed = (Date.now() - startTime.current) / 1000;
        const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
        const timeRemaining = speed > 0 ? (file.size - bytesTransferred) / speed : 0;
        
        setTransferProgress({
          bytesTransferred,
          totalBytes: file.size,
          percentage: (bytesTransferred / file.size) * 100,
          speed,
          timeRemaining
        });
        
        // Minimal delay to prevent browser freezing
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        console.log(`📤 Sent chunk ${i}/${totalChunks}, speed: ${(speed/1024/1024).toFixed(2)} MB/s`);
      }
      
      // Send completion signal
      conn.send({
        type: 'speed_complete',
        totalChunks,
        fileSize: file.size,
        timestamp: Date.now()
      });
      
      console.log('🎉 MAXIMUM SPEED: Transfer completed');
      
    } finally {
      setIsTransferring(false);
    }
  };

  // MAXIMUM SPEED: Receive as fast as possible
  const receiveFileMaximumSpeed = async (conn: DataConnection): Promise<Blob> => {
    setIsTransferring(true);
    startTime.current = Date.now();
    
    const chunks = new Map<number, ArrayBuffer>();
    let totalChunks = 0;
    let bytesReceived = 0;
    let fileSize = 0;
    
    return new Promise((resolve) => {
      const handleMessage = (data: any) => {
        if (data.type === 'speed_chunk') {
          // Store chunk immediately
          chunks.set(data.chunkIndex, data.data);
          bytesReceived += data.data.byteLength;
          
          // Update progress
          const elapsed = (Date.now() - startTime.current) / 1000;
          const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
          const timeRemaining = speed > 0 ? (fileSize - bytesReceived) / speed : 0;
          
          setTransferProgress({
            bytesTransferred: bytesReceived,
            totalBytes: fileSize,
            percentage: fileSize > 0 ? (bytesReceived / fileSize) * 100 : 0,
            speed,
            timeRemaining
          });
          
          console.log(`📥 Received chunk ${data.chunkIndex}, speed: ${(speed/1024/1024).toFixed(2)} MB/s`);
          
          // Check if complete
          if (chunks.size === totalChunks && totalChunks > 0) {
            // Reassemble file in order
            const sortedChunks = Array.from(chunks.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([, data]) => data);
            
            const blob = new Blob(sortedChunks);
            setIsTransferring(false);
            conn.off('data', handleMessage);
            resolve(blob);
          }
          
        } else if (data.type === 'speed_complete') {
          totalChunks = data.totalChunks;
          fileSize = data.fileSize;
          console.log(`📊 Expecting ${totalChunks} chunks, total size: ${(fileSize/1024/1024).toFixed(2)}MB`);
        }
      };
      
      conn.on('data', handleMessage);
    });
  };

  // Main transfer function
  const transferFileMaximumSpeed = async (
    conn: DataConnection,
    file: File,
    isSender: boolean
  ): Promise<Blob | void> => {
    if (isSender) {
      await sendFileMaximumSpeed(conn, file);
    } else {
      return await receiveFileMaximumSpeed(conn);
    }
  };

  return {
    transferProgress,
    isTransferring,
    transferFileMaximumSpeed
  };
};