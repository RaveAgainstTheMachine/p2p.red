import React from 'react';
import { Download } from 'lucide-react';

interface DropZoneProps {
  isProcessing?: boolean;
  showUI?: boolean;
  dragActive?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  isProcessing = false,
  showUI = true,
  dragActive = false
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
        <div className="fixed inset-0 z-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 shadow-xl">
              <Download size={32} className="text-[var(--theme-primary)]" />
            </div>

            {isProcessing ? (
              <div className="text-center">
                <p className="text-[var(--theme-text-secondary)] font-medium">Processing…</p>
                <p className="text-[var(--theme-text-secondary)]/50 text-sm mt-1">Hang tight.</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[var(--theme-text-secondary)] text-lg">Drop files or folders anywhere</p>
                <p className="text-[var(--theme-text-secondary)]/80 text-sm mt-1">or click anywhere to pick your files</p>
              </div>
            )}
            
            <p className="fixed bottom-24 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 pointer-events-none whitespace-nowrap">
              Your files are encrypted in your browser before sending
            </p>
          </div>
        </div>
      )}
    </>
  );
};
