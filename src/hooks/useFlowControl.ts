import { useState, useRef } from 'react';

interface FlowControlMetrics {
  senderSpeed: number;
  receiverSpeed: number;
  bufferUtilization: number;
  rtt: number;
}

export const useFlowControl = () => {
  const [metrics, setMetrics] = useState<FlowControlMetrics>({
    senderSpeed: 0,
    receiverSpeed: 0,
    bufferUtilization: 0,
    rtt: 0
  });

  const senderWindow = useRef(10); // Start with 10 chunks window
  const receiverCapacity = useRef(10);
  const lastAckTime = useRef(Date.now());
  const pendingChunks = useRef(new Set<number>());

  const calculateOptimalWindow = (receiverSpeed: number, rtt: number) => {
    // Bandwidth-delay product calculation
    const bandwidthDelayProduct = (receiverSpeed * rtt) / 1000; // Convert to chunks
    const optimalWindow = Math.max(5, Math.min(50, Math.ceil(bandwidthDelayProduct)));
    
    console.log(`🎯 Flow Control: Receiver speed=${receiverSpeed}KB/s, RTT=${rtt}ms, Optimal window=${optimalWindow}`);
    return optimalWindow;
  };

  const senderCanSend = (chunkIndex: number) => {
    const windowSize = senderWindow.current;
    const pendingCount = pendingChunks.current.size;
    
    // Can send if we haven't exceeded the window
    const canSend = pendingCount < windowSize;
    
    if (canSend) {
      pendingChunks.current.add(chunkIndex);
    }
    
    return canSend;
  };

  const onReceiverAck = (chunkIndex: number, receiverProcessingSpeed: number) => {
    // Remove chunk from pending set
    pendingChunks.current.delete(chunkIndex);
    
    // Update receiver capacity
    receiverCapacity.current = receiverProcessingSpeed;
    
    // Calculate RTT
    const rtt = Date.now() - lastAckTime.current;
    lastAckTime.current = Date.now();
    
    // Adjust sender window based on receiver performance
    const newWindow = calculateOptimalWindow(receiverProcessingSpeed, rtt);
    senderWindow.current = newWindow;
    
    // Update metrics
    setMetrics(prev => ({
      ...prev,
      receiverSpeed: receiverProcessingSpeed,
      rtt: rtt,
      bufferUtilization: pendingChunks.current.size / senderWindow.current
    }));
    
    console.log(`📡 ACK received: Chunk ${chunkIndex}, New window: ${newWindow}, Pending: ${pendingChunks.current.size}`);
  };

  const waitForSendWindow = async () => {
    while (pendingChunks.current.size >= senderWindow.current) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  const getBackpressureSignal = () => {
    const utilization = pendingChunks.current.size / senderWindow.current;
    
    if (utilization > 0.8) {
      return 'HIGH'; // Slow down significantly
    } else if (utilization > 0.5) {
      return 'MEDIUM'; // Moderate throttling
    } else {
      return 'LOW'; // Full speed ahead
    }
  };

  return {
    metrics,
    senderCanSend,
    onReceiverAck,
    waitForSendWindow,
    getBackpressureSignal,
    senderWindow: senderWindow.current,
    pendingChunks: pendingChunks.current.size
  };
};
