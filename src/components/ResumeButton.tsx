import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ResumeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  progress?: number;
}

export const ResumeButton: React.FC<ResumeButtonProps> = ({ 
  onClick, 
  disabled = false, 
  progress = 0 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        transition-all duration-300 ease-in-out
        ${disabled 
          ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed opacity-50' 
          : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95'
        }
      `}
    >
      <RefreshCw size={16} className={disabled ? '' : 'animate-spin-slow'} />
      <span>{disabled ? 'Cannot Resume' : 'Resume Transfer'}</span>
      {progress > 0 && (
        <span className="text-sm opacity-75">({progress.toFixed(1)}%)</span>
      )}
    </button>
  );
};
