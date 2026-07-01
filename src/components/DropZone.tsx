import React from 'react';
import { Download } from 'lucide-react';
import { SecurityTicker } from './SecurityTicker';

interface DropZoneProps {
  isProcessing?: boolean;
  showUI?: boolean;
  dragActive?: boolean;
  onPickFiles?: (e?: React.MouseEvent) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  isProcessing = false,
  showUI = true,
  dragActive = false,
  onPickFiles
}) => {
  return (
    <>
      {dragActive && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center gap-4 bg-[var(--theme-bg-1)]/80 backdrop-blur-md">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border-2 border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 shadow-[0_0_50px_var(--theme-glow)]">
            <Download size={40} className="text-[var(--theme-primary)] animate-bounce" />
          </div>
          <p className="text-3xl font-bold text-[var(--theme-primary)]">Drop to share</p>
          <p className="text-sm font-medium opacity-60">End-to-end encrypted · No server storage</p>
        </div>
      )}

      {showUI && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none select-none px-4">
          <div 
            className="flex flex-col items-center gap-4 sm:gap-6 pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
            onClick={onPickFiles}
            role="button"
            tabIndex={0}
          >
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[1.5rem] bg-[var(--theme-primary)]/10 border-2 border-[var(--theme-primary)]/40 shadow-[0_0_30px_var(--theme-glow)] transition-all">
              <Download size={28} className="text-[var(--theme-primary)] sm:w-8 sm:h-8" />
            </div>

            {isProcessing ? (
              <div className="text-center">
                <p className="text-white/70 font-medium">Processing…</p>
                <p className="text-white/40 text-xs sm:text-sm mt-1">Hang tight.</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-white/70 text-lg sm:text-2xl font-medium">Drop files or folders</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 sm:mt-10 pointer-events-auto">
            <SecurityTicker />
          </div>
        </div>
      )}
    </>
  );
};
