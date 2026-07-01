import { useEffect, useRef, useState } from 'react';

import { createTransferEngine } from '../services/TransferEngine';
import { AdaptiveTransferProgress } from '../services/TransferEngine';

export const useAdaptiveMultiStreamTransfer = () => {
  const engineRef = useRef(createTransferEngine());
  const [progress, setProgress] = useState<AdaptiveTransferProgress | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    const handleProgress = (p: AdaptiveTransferProgress) => setProgress(p);
    engine.on('progress', handleProgress);
    return () => {
      engine.off('progress', handleProgress);
    };
  }, []);

  return {
    transferFileAdaptive: engineRef.current.transferFileAdaptive,
    transferProgress: progress || engineRef.current.transferProgress,
    isTransferring: engineRef.current.isTransferring,
    prepareDownloadBridge: engineRef.current.prepareDownloadBridge
  };
};
