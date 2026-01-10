import React from 'react';
import { TransferProgress } from '../hooks/useFileTransfer';

interface EnhancedProgressBarProps {
  progress: TransferProgress;
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

  const formatTime = (seconds: number) => {
    if (seconds === 0 || !isFinite(seconds)) return '--';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

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
                       rounded-full transition-all duration-300 ease-out
                       relative overflow-hidden"
            style={{ width: `${progress.percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                           via-white/20 to-transparent animate-shine" />
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <span className="text-white/60 text-xs">
            {Math.round(progress.percentage)}%
          </span>
          {(showSpeed && progress.speed > 0) && (
            <span className="text-white/60 text-xs">
              {formatSpeed(progress.speed)}
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
                     rounded-full transition-all duration-300 ease-out
                     relative overflow-hidden"
          style={{ width: `${progress.percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                         via-white/20 to-transparent animate-shine" />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-white/80 font-medium">
            {Math.round(progress.percentage)}%
          </div>
          <div className="text-white/60 text-sm">Progress</div>
        </div>
        
        {showSpeed && (
          <div>
            <div className="text-white/80 font-medium">
              {formatSpeed(progress.speed)}
            </div>
            <div className="text-white/60 text-sm">Speed</div>
          </div>
        )}
        
        {showETA && (
          <div>
            <div className="text-white/80 font-medium">
              {formatTime(progress.timeRemaining)}
            </div>
            <div className="text-white/60 text-sm">Remaining</div>
          </div>
        )}
      </div>
    </div>
  );
};
