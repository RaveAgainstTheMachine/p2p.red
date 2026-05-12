import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TransferProgress } from '../shared';

interface EnhancedProgressBarProps {
  progress: TransferProgress & {
    activeStreams?: number;
    networkQuality?: string;
    rttMs?: number;
    candidateType?: string;
    receiverBackpressureLevel?: string;
    cachedShardBytes?: number;
    maxCachedShardBytes?: number;
  };
  label?: string;
  showETA?: boolean;
  showSpeed?: boolean;
  compact?: boolean;
}

export const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({ 
  progress, 
  label, 
  showETA = true,
  showSpeed = true,
  compact = false
}) => {
  const [speedUnit, setSpeedUnit] = useState<'Mb/s' | 'MB/s'>('Mb/s');

  const [displayPercentage, setDisplayPercentage] = useState<number>(() => {
    const p = Number.isFinite(progress.percentage) ? progress.percentage : 0;
    return Math.max(0, Math.min(100, p));
  });
  const displayPercentageRef = useRef(displayPercentage);
  const rafRef = useRef<number | null>(null);
  const lastAnimTsRef = useRef<number | null>(null);

  const [displaySpeedBps, setDisplaySpeedBps] = useState<number>(() => {
    const s = Number.isFinite(progress.speed) ? progress.speed : 0;
    return Math.max(0, s);
  });
  const displaySpeedRef = useRef(displaySpeedBps);
  const lastSpeedTsRef = useRef<number | null>(null);

  useEffect(() => {
    displayPercentageRef.current = displayPercentage;
  }, [displayPercentage]);

  useEffect(() => {
    displaySpeedRef.current = displaySpeedBps;
  }, [displaySpeedBps]);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Number.isFinite(progress.percentage) ? progress.percentage : 0));
    const current = displayPercentageRef.current;

    if (target <= 0 || target < current || target >= 100) {
      setDisplayPercentage(target);
      displayPercentageRef.current = target;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastAnimTsRef.current = null;
      return;
    }

    if (rafRef.current !== null) return;

    const tick = (ts: number) => {
      const prevTs = lastAnimTsRef.current ?? ts;
      lastAnimTsRef.current = ts;
      const dt = Math.max(0, ts - prevTs);

      const latestTarget = Math.max(0, Math.min(100, Number.isFinite(progress.percentage) ? progress.percentage : 0));
      const prev = displayPercentageRef.current;

      const tauMs = 220;
      const k = 1 - Math.exp(-dt / tauMs);
      const next = Math.min(latestTarget, prev + (latestTarget - prev) * k);

      if (Math.abs(next - prev) < 0.02 || next >= latestTarget) {
        setDisplayPercentage(latestTarget);
        displayPercentageRef.current = latestTarget;
        rafRef.current = null;
        lastAnimTsRef.current = null;
        return;
      }

      setDisplayPercentage(next);
      displayPercentageRef.current = next;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastAnimTsRef.current = null;
    };
  }, [progress.percentage]);

  useEffect(() => {
    const target = Math.max(0, Number.isFinite(progress.speed) ? progress.speed : 0);
    const now = performance.now();
    const prevTs = lastSpeedTsRef.current ?? now;
    lastSpeedTsRef.current = now;

    if (target <= 0) {
      setDisplaySpeedBps(0);
      displaySpeedRef.current = 0;
      return;
    }

    const prev = displaySpeedRef.current;
    const dt = Math.max(0, now - prevTs);
    const tauMs = 600;
    const alpha = 1 - Math.exp(-dt / tauMs);
    const next = prev + (target - prev) * alpha;
    setDisplaySpeedBps(next);
    displaySpeedRef.current = next;
  }, [progress.speed]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatRtt = (ms?: number) => {
    if (ms === undefined || !isFinite(ms)) return '--';
    if (ms < 1) return '<1ms';
    return `${Math.round(ms)}ms`;
  };

  const formatPercent = (value: number) => {
    if (!isFinite(value)) return '--';
    return `${Math.round(value)}%`;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '--';
    if (seconds <= 0) return '0s';

    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = Math.round(seconds - m * 60);
      return `${m}m ${s}s`;
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds - h * 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond <= 0 || !isFinite(bytesPerSecond)) {
      return speedUnit === 'Mb/s' ? '0 Kb/s' : '0 KB/s';
    }

    if (speedUnit === 'Mb/s') {
      const bps = bytesPerSecond * 8;
      if (bps < 1_000_000) {
        return `${(bps / 1_000).toFixed(1)} Kb/s`;
      }
      return `${(bps / 1_000_000).toFixed(1)} Mb/s`;
    }

    if (bytesPerSecond < 1_000_000) {
      return `${(bytesPerSecond / 1_000).toFixed(1)} KB/s`;
    }
    return `${(bytesPerSecond / 1_000_000).toFixed(1)} MB/s`;
  };

  const speedToggleLabel = useMemo(() => {
    return speedUnit === 'Mb/s' ? 'Mb/s' : 'MB/s';
  }, [speedUnit]);

  const displayTimeRemainingSeconds = useMemo(() => {
    const remaining = Math.max(0, (Number.isFinite(progress.totalBytes) ? progress.totalBytes : 0) - (Number.isFinite(progress.bytesTransferred) ? progress.bytesTransferred : 0));
    if (displaySpeedBps > 0 && isFinite(displaySpeedBps)) {
      return remaining / displaySpeedBps;
    }
    return progress.timeRemaining;
  }, [displaySpeedBps, progress.bytesTransferred, progress.timeRemaining, progress.totalBytes]);

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-white/80 text-sm">{label}</span>
          <span className="text-white/80 text-sm">
            {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
          </span>
        </div>
        
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 
                       rounded-full transition-[width] duration-75 ease-out
                       relative overflow-hidden"
            style={{ width: `${displayPercentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                           via-white/20 to-transparent animate-shine" />
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <span className="text-white/60 text-xs">
            {formatPercent(displayPercentage)}
          </span>
          {(showSpeed && progress.speed > 0) && (
            <span className="text-white/60 text-xs">
              {formatSpeed(displaySpeedBps)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {label && (
        <div className="flex justify-between items-center mb-3">
          <span className="text-white/80 font-medium">{label}</span>
          <span className="text-white/80">
            {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
          </span>
        </div>
      )}
      
      <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 
                     rounded-full transition-[width] duration-75 ease-out
                     relative overflow-hidden"
          style={{ width: `${displayPercentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                         via-white/20 to-transparent animate-shine" />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-white/80 font-medium">
            {formatPercent(displayPercentage)}
          </div>
          <div className="text-white/60 text-sm">Progress</div>
        </div>
        
        {showSpeed && (
          <div>
            <div className="text-white/80 font-medium flex items-center justify-center gap-2">
              <span>{formatSpeed(displaySpeedBps)}</span>
              <button
                type="button"
                className="text-white/60 text-xs underline hover:text-white/80 transition-colors"
                onClick={() => setSpeedUnit(prev => (prev === 'Mb/s' ? 'MB/s' : 'Mb/s'))}
                aria-label="Toggle speed units"
              >
                {speedToggleLabel}
              </button>
            </div>
            <div className="text-white/60 text-sm">Speed</div>
          </div>
        )}
        
        {showETA && (
          <div>
            <div className="text-white/80 font-medium">
              {formatTime(displayTimeRemainingSeconds)}
            </div>
            <div className="text-white/60 text-sm">Remaining</div>
          </div>
        )}
      </div>

      {(progress.activeStreams !== undefined || progress.networkQuality || progress.rttMs !== undefined || progress.candidateType || progress.receiverBackpressureLevel || (progress.cachedShardBytes !== undefined && progress.maxCachedShardBytes !== undefined)) && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-white/80 font-medium">
              {progress.activeStreams !== undefined ? progress.activeStreams : '--'}
            </div>
            <div className="text-white/60 text-sm">Streams</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">
              {progress.networkQuality || '--'}
            </div>
            <div className="text-white/60 text-sm">Link</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">
              {formatRtt(progress.rttMs)}
            </div>
            <div className="text-white/60 text-sm">RTT</div>
          </div>

          <div>
            <div className="text-white/80 font-medium">
              {progress.candidateType || '--'}
            </div>
            <div className="text-white/60 text-sm">Path</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">
              {progress.receiverBackpressureLevel || '--'}
            </div>
            <div className="text-white/60 text-sm">Receiver</div>
          </div>
          <div>
            <div className="text-white/80 font-medium">
              {(progress.cachedShardBytes !== undefined && progress.maxCachedShardBytes !== undefined)
                ? formatPercent((progress.cachedShardBytes / Math.max(1, progress.maxCachedShardBytes)) * 100)
                : '--'}
            </div>
            <div className="text-white/60 text-sm">Sender Cache</div>
          </div>
        </div>
      )}
    </div>
  );
};
