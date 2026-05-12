import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  label, 
  showPercentage = true 
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full max-w-md mx-auto">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/80 text-sm">{label}</span>
          {showPercentage && (
            <span className="text-white/80 text-sm">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 
                     rounded-full transition-all duration-300 ease-out
                     relative overflow-hidden"
          style={{ width: `${clampedProgress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                         via-white/20 to-transparent animate-shine" />
        </div>
      </div>
    </div>
  );
};
