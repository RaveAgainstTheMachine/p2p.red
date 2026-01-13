import { useRef, useEffect } from 'react';

interface WebRTCMetrics {
  actualSendRate: number;      // Actual WebRTC send rate
  actualReceiveRate: number;    // Actual WebRTC receive rate
  bufferAmount: number;         // WebRTC buffer utilization
  channelState: string;        // DataChannel state
}

export const useWebRTCMetrics = (dataChannel: RTCDataChannel | null) => {
  const metrics = useRef<WebRTCMetrics>({
    actualSendRate: 0,
    actualReceiveRate: 0,
    bufferAmount: 0,
    channelState: 'closed'
  });

  const sendBuffer = useRef<{ timestamp: number; bytes: number }[]>([]);
  const receiveBuffer = useRef<{ timestamp: number; bytes: number }[]>([]);

  // Monitor actual WebRTC performance
  const updateMetrics = () => {
    if (!dataChannel) return;

    const now = Date.now();
    
    // Calculate actual send rate from WebRTC buffer changes
    const currentBufferAmount = dataChannel.bufferedAmount;
    metrics.current.bufferAmount = currentBufferAmount;
    metrics.current.channelState = dataChannel.readyState;

    // Track buffer changes to infer actual send rate
    sendBuffer.current.push({ timestamp: now, bytes: currentBufferAmount });
    if (sendBuffer.current.length > 10) {
      sendBuffer.current.shift();
    }

    // Calculate actual send rate (buffer depletion rate)
    if (sendBuffer.current.length >= 2) {
      const oldest = sendBuffer.current[0];
      const newest = sendBuffer.current[sendBuffer.current.length - 1];
      const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds
      const bufferDiff = oldest.bytes - newest.bytes; // bytes sent
      
      if (timeDiff > 0 && bufferDiff > 0) {
        metrics.current.actualSendRate = bufferDiff / timeDiff;
      }
    }

    console.log('🔍 WebRTC Metrics:', {
      sendRate: (metrics.current.actualSendRate / 1024 / 1024).toFixed(2) + ' MB/s',
      bufferAmount: (metrics.current.bufferAmount / 1024 / 1024).toFixed(2) + ' MB',
      channelState: metrics.current.channelState
    });
  };

  // Set up monitoring interval
  useEffect(() => {
    if (!dataChannel) return;

    const interval = setInterval(updateMetrics, 500); // Update every 500ms
    
    return () => clearInterval(interval);
  }, [dataChannel]);

  // Monitor message events for actual receive rate
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (event: MessageEvent) => {
      const now = Date.now();
      const bytes = event.data instanceof ArrayBuffer ? event.data.byteLength : 
                   event.data.size || 0;

      receiveBuffer.current.push({ timestamp: now, bytes });
      if (receiveBuffer.current.length > 10) {
        receiveBuffer.current.shift();
      }

      // Calculate actual receive rate
      if (receiveBuffer.current.length >= 2) {
        const oldest = receiveBuffer.current[0];
        const newest = receiveBuffer.current[receiveBuffer.current.length - 1];
        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds
        const totalBytes = receiveBuffer.current.reduce((sum, item) => sum + item.bytes, 0);
        
        if (timeDiff > 0) {
          metrics.current.actualReceiveRate = totalBytes / timeDiff;
        }
      }
    };

    dataChannel.addEventListener('message', handleMessage);
    
    return () => {
      dataChannel.removeEventListener('message', handleMessage);
    };
  }, [dataChannel]);

  return metrics.current;
};
