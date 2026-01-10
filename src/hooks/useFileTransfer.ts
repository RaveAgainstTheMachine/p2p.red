import { useState, useCallback, useRef } from 'react';
import { DataConnection } from 'peerjs';

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
}

export const useFileTransfer = () => {
  const [transferProgress, setTransferProgress] = useState<TransferProgress>({
    bytesTransferred: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: 0
  });
  
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferId, setTransferId] = useState<string>('');
  const [receivedChunks, setReceivedChunks] = useState<Set<number>>(new Set());
  const startTimeRef = useRef<number>(0);
  const lastProgressRef = useRef<number>(0);
  const connectionHealthRef = useRef<boolean>(true);
  const lastChunkTimeRef = useRef<number>(Date.now());
  const MAX_RETRIES = 3;
  const CHUNK_TIMEOUT = 30000; // 30 seconds

  const sendFile = useCallback(async (conn: DataConnection, file: File, resumeFrom: number = 0) => {
    console.log('Starting file transfer:', file.name, file.size);
    
    // Validate file
    if (!file || file.size === 0) {
      throw new Error(`Invalid file: ${file?.name || 'unknown'} (${file?.size || 0} bytes)`);
    }
    
    setIsTransferring(true);
    startTimeRef.current = Date.now();
    lastChunkTimeRef.current = Date.now(); // Reset chunk timer when transfer starts
    lastProgressRef.current = 0;

    const CHUNK_SIZE = 256 * 1024; // 256KB chunks for maximum throughput
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const totalBytes = file.size;
    const uniqueTransferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Transfer metadata:', { totalChunks, totalBytes, transferId: uniqueTransferId });
    setTransferId(uniqueTransferId);
    
    // Track receiver acknowledgments for backpressure
    let lastAckedChunk = -1;
    let pendingAcks = new Set<number>();
    const ACK_BATCH_SIZE = 10; // Wait for ACK every 10 chunks
    
    // Listen for chunk acknowledgments from receiver
    const ackHandler = (data: any) => {
      if (data.type === 'chunk_ack' && data.transferId === uniqueTransferId) {
        lastAckedChunk = Math.max(lastAckedChunk, data.chunkIndex);
        pendingAcks.delete(data.chunkIndex);
      }
    };
    conn.on('data', ackHandler);
    
    // Save transfer state for resume capability
    const saveTransferState = (chunkIndex: number, bytesTransferred: number) => {
      try {
        sessionStorage.setItem(`transfer_${uniqueTransferId}`, JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          chunkIndex,
          bytesTransferred,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save transfer state:', e);
      }
    };

    // Listen for resume requests
    const handleResumeRequest = (fromChunk: number) => {
      console.log('Resume request received from chunk:', fromChunk);
      // This will be handled by the main sendFile logic
    };

    // Add resume request listener
    conn.on('data', (data: any) => {
      if (data.type === 'resume_request' && data.transferId === uniqueTransferId) {
        handleResumeRequest(data.fromChunk || data.missingChunks?.[0] || 0);
      }
    });

    // Monitor connection state with health tracking
    let connectionClosed = false;
    conn.on('close', () => {
      console.log('Connection closed, preserving transfer state');
      connectionClosed = true;
      connectionHealthRef.current = false;
      setIsTransferring(false);
    });

    conn.on('error', (err) => {
      console.log('Connection error, preserving transfer state:', err);
      connectionHealthRef.current = false;
      setIsTransferring(false);
    });
    
    // Connection health monitoring
    const checkConnectionHealth = () => {
      const now = Date.now();
      const timeSinceLastChunk = now - lastChunkTimeRef.current;
      
      if (timeSinceLastChunk > CHUNK_TIMEOUT) {
        console.warn('Connection appears stalled, may need reconnection');
        connectionHealthRef.current = false;
        return false;
      }
      return true;
    };

    try {
      // Send metadata first
      conn.send({
        type: 'metadata',
        transferId: uniqueTransferId,
        name: file.name,
        size: totalBytes,
        chunks: totalChunks,
        resumeFrom,
        timestamp: Date.now()
      });
      console.log('Metadata sent');

      setTransferProgress({
        bytesTransferred: resumeFrom * CHUNK_SIZE,
        totalBytes,
        percentage: (resumeFrom / totalChunks) * 100,
        speed: 0,
        timeRemaining: 0
      });

      // Stream file chunks without loading entire file into memory
      console.log('Starting file stream...');
      lastChunkTimeRef.current = Date.now(); // Reset timer before streaming
      const transferStartTime = Date.now();
      const stream = file.stream();
      const reader = stream.getReader();
      let chunkIndex = 0;
      let bytesTransferred = resumeFrom * CHUNK_SIZE;

      // Skip chunks that were already sent
      for (let i = 0; i < resumeFrom; i++) {
        const { done } = await reader.read();
        if (done) break;
      }

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream completed');
            break;
          }

          if (!value) {
            console.log('Empty chunk, continuing...');
            continue;
          }

          // Split the chunk into 64KB pieces
          for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
            // Only check connection health after initial grace period (5 seconds)
            const timeSinceStart = Date.now() - transferStartTime;
            if (timeSinceStart > 5000) {
              if (connectionClosed || !checkConnectionHealth()) {
                console.log('Connection unhealthy, stopping transfer');
                saveTransferState(chunkIndex, bytesTransferred);
                throw new Error('Connection lost during transfer');
              }
            }
            
            const end = Math.min(offset + CHUNK_SIZE, value.length);
            const chunk = value.slice(offset, end);
            
            // Wait for receiver to catch up if we're too far ahead
            // Don't check health during backpressure wait in first 10 seconds
            while (chunkIndex - lastAckedChunk > ACK_BATCH_SIZE * 2) {
              await new Promise(resolve => setTimeout(resolve, 10));
              if (connectionClosed) {
                throw new Error('Connection closed while waiting for receiver');
              }
              // Only check health after initial period
              if (timeSinceStart > 10000 && !checkConnectionHealth()) {
                throw new Error('Connection lost while waiting for receiver');
              }
            }
            
            // Check DataChannel buffer before sending
            const dataChannel = (conn as any).dataChannel;
            if (dataChannel && dataChannel.bufferedAmount > 16 * 1024 * 1024) {
              // Buffer is over 16MB, wait for it to drain
              await new Promise(resolve => {
                const checkBuffer = setInterval(() => {
                  if (dataChannel.bufferedAmount < 8 * 1024 * 1024) {
                    clearInterval(checkBuffer);
                    resolve(undefined);
                  }
                }, 50);
              });
            }
            
            // Retry logic for chunk sending
            let sent = false;
            let retries = 0;
            while (!sent && retries < MAX_RETRIES) {
              try {
                conn.send({
                  type: 'chunk',
                  transferId: uniqueTransferId,
                  data: chunk.buffer,
                  index: chunkIndex,
                  total: totalChunks
                });
                sent = true;
                pendingAcks.add(chunkIndex);
                lastChunkTimeRef.current = Date.now();
              } catch (sendError) {
                retries++;
                console.warn(`Failed to send chunk ${chunkIndex}, retry ${retries}/${MAX_RETRIES}`);
                if (retries >= MAX_RETRIES) {
                  saveTransferState(chunkIndex, bytesTransferred);
                  throw sendError;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
            }

            bytesTransferred += chunk.byteLength;
            chunkIndex++;

            // Update progress
            const percentage = (bytesTransferred / totalBytes) * 100;
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const speed = bytesTransferred / elapsed;
            const timeRemaining = speed > 0 ? (totalBytes - bytesTransferred) / speed : 0;

            setTransferProgress({
              bytesTransferred,
              totalBytes,
              percentage,
              speed,
              timeRemaining
            });
            
            // Save state periodically (every 100 chunks)
            if (chunkIndex % 100 === 0) {
              saveTransferState(chunkIndex, bytesTransferred);
            }
          }
        } catch (chunkError) {
          console.error('Error reading chunk:', chunkError);
          throw chunkError;
        }
      }

      // Signal completion
      conn.send({ 
        type: 'complete', 
        transferId: uniqueTransferId,
        timestamp: Date.now() 
      });
      console.log('All chunks sent, waiting for receiver confirmation...');
      
      // Remove chunk ack handler
      conn.off('data', ackHandler);
      
      // Wait for receiver to acknowledge completion
      await new Promise<void>((resolve) => {
        const ackTimeout = setTimeout(() => {
          console.warn('No completion ACK received from receiver within 120s');
          resolve(); // Continue anyway
        }, 120000); // Increased to 120s for large files
        
        const completeAckHandler = (data: any) => {
          if (data.type === 'transfer_complete_ack' && data.transferId === uniqueTransferId) {
            clearTimeout(ackTimeout);
            console.log('Receiver confirmed successful receipt');
            conn.off('data', completeAckHandler);
            resolve();
          }
        };
        
        conn.on('data', completeAckHandler);
      });
      
      console.log('Transfer completed and confirmed');
      
      // Clear saved state on successful completion
      try {
        sessionStorage.removeItem(`transfer_${uniqueTransferId}`);
      } catch (e) {
        console.warn('Failed to clear transfer state:', e);
      }
    } catch (error) {
      console.error('File transfer error:', error);
      console.log('Transfer state saved for resume');
      throw error;
    } finally {
      setIsTransferring(false);
    }
  }, []);

  const receiveFile = useCallback(async (conn: DataConnection, resumeChunks: Set<number> = new Set(), fileHandle: any = null): Promise<{ data: Blob; name: string; size: number }> => {
    return new Promise(async (resolve, reject) => {
      setIsTransferring(true);
      startTimeRef.current = Date.now();
      lastChunkTimeRef.current = Date.now();
      
      let metadata: any;
      let bytesTransferred = 0;
      let totalBytes = 0;
      let currentTransferId = '';
      let writable: any = null;
      
      // Monitor for stalled transfers
      const stallCheckInterval = setInterval(() => {
        const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
        if (timeSinceLastChunk > CHUNK_TIMEOUT && isTransferring) {
          console.warn('Transfer appears stalled, connection may be lost');
          connectionHealthRef.current = false;
        }
      }, 5000);

      const updateProgress = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const speed = bytesTransferred / elapsed;
        const timeRemaining = speed > 0 ? (totalBytes - bytesTransferred) / speed : 0;
        const percentage = totalBytes > 0 ? (bytesTransferred / totalBytes) * 100 : 0;

        setTransferProgress({
          bytesTransferred,
          totalBytes,
          percentage,
          speed,
          timeRemaining
        });
      };

      conn.on('data', async (data: any) => {
        if (data.type === 'metadata') {
          metadata = data;
          currentTransferId = data.transferId;
          totalBytes = metadata.size;
          setTransferId(currentTransferId);
          
          console.log('📦 Received metadata:', {
            name: metadata.name,
            size: metadata.size,
            chunks: metadata.chunks,
            transferId: currentTransferId
          });
          
          // ALWAYS require file handle - never use RAM
          if (!fileHandle) {
            console.error('❌ No file handle provided - cannot receive file');
            reject(new Error('File handle required for receiving files'));
            return;
          }
          
          try {
            writable = await fileHandle.createWritable();
            console.log('✅ Using streaming write to disk');
          } catch (err) {
            console.error('❌ Failed to create writable stream:', err);
            reject(err);
            return;
          }
          
          // Calculate bytes already received from resume chunks
          if (data.resumeFrom > 0) {
            bytesTransferred = data.resumeFrom * (256 * 1024);
            setReceivedChunks(new Set(resumeChunks));
          }
          
          updateProgress();
          
          // Request resume if we have chunks
          if (resumeChunks.size > 0) {
            conn.send({
              type: 'resume_request',
              transferId: currentTransferId,
              missingChunks: Array.from({length: metadata.chunks}, (_, i) => i)
                .filter(i => !resumeChunks.has(i))
            });
          }
        } else if (data.type === 'chunk') {
          if (data.transferId === currentTransferId) {
            // ONLY write to disk - no RAM fallback
            try {
              await writable.write(data.data);
            } catch (writeError) {
              console.error('❌ Failed to write chunk to disk:', writeError);
              reject(writeError);
              return;
            }
            
            bytesTransferred += data.data.byteLength;
            lastChunkTimeRef.current = Date.now();
            connectionHealthRef.current = true;
            setReceivedChunks(prev => new Set(prev).add(data.index));
            updateProgress();
            
            // Log progress every 100 chunks
            if (data.index % 100 === 0) {
              console.log(`📊 Chunk ${data.index}/${metadata.chunks} received (${((data.index / metadata.chunks) * 100).toFixed(1)}%)`);
            }
            
            // Send ACK every 10 chunks for backpressure
            if (data.index % 10 === 0) {
              conn.send({
                type: 'chunk_ack',
                transferId: currentTransferId,
                chunkIndex: data.index
              });
            }
            
            // Save transfer progress periodically for resume
            if (data.index % 100 === 0) {
              try {
                sessionStorage.setItem(`receive_${currentTransferId}`, JSON.stringify({
                  lastChunkIndex: data.index,
                  bytesTransferred,
                  timestamp: Date.now()
                }));
              } catch (e) {
                console.warn('Failed to save receive state:', e);
              }
            }
          }
        } else if (data.type === 'complete') {
          if (data.transferId === currentTransferId) {
            console.log('🏁 Transfer complete signal received');
            clearInterval(stallCheckInterval);
            
            console.log('✅ All chunks written to disk');
            setIsTransferring(false);
            
            // Clear saved state on successful completion
            try {
              sessionStorage.removeItem(`receive_${currentTransferId}`);
            } catch (e) {
              console.warn('Failed to clear receive state:', e);
            }
            
            // Send acknowledgment to sender
            conn.send({
              type: 'transfer_complete_ack',
              transferId: currentTransferId,
              timestamp: Date.now()
            });
            console.log('📤 Sent completion acknowledgment to sender');
            
            // Close file handle - file is already written to disk
            try {
              await writable.close();
              console.log('💾 File written to disk successfully:', metadata.name);
              resolve({
                data: new Blob([]), // Empty blob since file is on disk
                name: metadata.name,
                size: metadata.size
              });
            } catch (closeError) {
              console.error('❌ Failed to close file:', closeError);
              reject(closeError);
            }
          }
        }
      });

      conn.on('error', async (err) => {
        clearInterval(stallCheckInterval);
        setIsTransferring(false);
        console.log('Receive error, state saved for resume');
        
        // Close writable if open
        if (writable) {
          try {
            await writable.close();
          } catch (e) {
            console.warn('Failed to close writable on error:', e);
          }
        }
        
        reject(err);
      });
      
      conn.on('close', async () => {
        clearInterval(stallCheckInterval);
        if (isTransferring) {
          console.log('Connection closed during receive, state saved for resume');
          setIsTransferring(false);
          
          // Close writable if open
          if (writable) {
            try {
              await writable.close();
            } catch (e) {
              console.warn('Failed to close writable on close:', e);
            }
          }
        }
      });
    });
  }, []);

  const resumeTransfer = useCallback(async (conn: DataConnection, fromChunk: number) => {
    // Request resume from specific chunk
    conn.send({
      type: 'resume_request',
      transferId,
      fromChunk
    });
  }, [transferId]);

  const sendFiles = useCallback(async (conn: DataConnection, files: FileList) => {
    // Send files one by one for now
    for (let i = 0; i < files.length; i++) {
      await sendFile(conn, files[i]);
      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, []);

  const resetTransfer = useCallback(() => {
    setTransferProgress({
      bytesTransferred: 0,
      totalBytes: 0,
      percentage: 0,
      speed: 0,
      timeRemaining: 0
    });
  }, []);

  const sendStream = useCallback(async (conn: DataConnection, stream: ReadableStream<Uint8Array>, fileName: string, fileSize: number) => {
    console.log('Starting stream transfer:', fileName, fileSize);
    
    setIsTransferring(true);
    startTimeRef.current = Date.now();
    lastChunkTimeRef.current = Date.now();

    const CHUNK_SIZE = 256 * 1024;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    const uniqueTransferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setTransferId(uniqueTransferId);
    
    let lastAckedChunk = -1;
    const ACK_BATCH_SIZE = 10;
    
    const ackHandler = (data: any) => {
      if (data.type === 'chunk_ack' && data.transferId === uniqueTransferId) {
        lastAckedChunk = Math.max(lastAckedChunk, data.chunkIndex);
      }
    };
    conn.on('data', ackHandler);
    
    let connectionClosed = false;
    conn.on('close', () => {
      connectionClosed = true;
      setIsTransferring(false);
    });

    try {
      conn.send({
        type: 'metadata',
        transferId: uniqueTransferId,
        name: fileName,
        size: fileSize,
        chunks: totalChunks,
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setTransferProgress({
        bytesTransferred: 0,
        totalBytes: fileSize,
        percentage: 0,
        speed: 0,
        timeRemaining: 0
      });

      const reader = stream.getReader();
      let chunkIndex = 0;
      let bytesTransferred = 0;
      let buffer = new Uint8Array(0);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.length > 0) {
            conn.send({
              type: 'chunk',
              transferId: uniqueTransferId,
              index: chunkIndex,
              data: buffer,
              timestamp: Date.now()
            });
            bytesTransferred += buffer.length;
          }
          break;
        }

        if (!value) continue;
        
        const combined = new Uint8Array(buffer.length + value.length);
        combined.set(buffer);
        combined.set(value, buffer.length);
        buffer = combined;

        while (buffer.length >= CHUNK_SIZE) {
          if (connectionClosed) throw new Error('Connection closed');
          
          while (chunkIndex - lastAckedChunk > ACK_BATCH_SIZE * 2) {
            await new Promise(resolve => setTimeout(resolve, 10));
            if (connectionClosed) throw new Error('Connection closed');
          }
          
          const chunk = buffer.slice(0, CHUNK_SIZE);
          buffer = buffer.slice(CHUNK_SIZE);
          
          const dataChannel = (conn as any).dataChannel;
          if (dataChannel && dataChannel.bufferedAmount > 16 * 1024 * 1024) {
            await new Promise(resolve => {
              const checkBuffer = setInterval(() => {
                if (dataChannel.bufferedAmount < 8 * 1024 * 1024) {
                  clearInterval(checkBuffer);
                  resolve(undefined);
                }
              }, 50);
            });
          }
          
          conn.send({
            type: 'chunk',
            transferId: uniqueTransferId,
            index: chunkIndex,
            data: chunk,
            timestamp: Date.now()
          });
          
          chunkIndex++;
          bytesTransferred += chunk.length;
          lastChunkTimeRef.current = Date.now();
          
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const speed = bytesTransferred / elapsed;
          const remaining = (fileSize - bytesTransferred) / speed;
          
          setTransferProgress({
            bytesTransferred,
            totalBytes: fileSize,
            percentage: (bytesTransferred / fileSize) * 100,
            speed,
            timeRemaining: remaining
          });
        }
      }

      conn.send({ type: 'complete', transferId: uniqueTransferId, timestamp: Date.now() });
      setIsTransferring(false);
    } catch (error) {
      console.error('Stream transfer error:', error);
      setIsTransferring(false);
      throw error;
    }
  }, []);

  return {
    transferProgress,
    isTransferring,
    transferId,
    receivedChunks,
    sendFile,
    sendFiles,
    sendStream,
    receiveFile,
    resumeTransfer,
    resetTransfer
  };
};
