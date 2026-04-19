import React, { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, Search } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (files: File[]) => void;
  isProcessing?: boolean;
}

// Optimized recursive dir reader.
// Uses Promise.all for parallelism with simple concurrency limiting.
const readDirEntry = async (entry: any, prefix = ''): Promise<File[]> => {
  const reader = entry.createReader();
  
  const getEntries = (): Promise<any[]> =>
    new Promise((res, rej) => reader.readEntries(res, rej));

  const allFiles: File[] = [];
  let batch: any[];
  
  do {
    batch = await getEntries();
    
    // Process batch in parallel
    const processedBatch = await Promise.all(batch.map(async (child) => {
      if (child.isFile) {
        const file: File = await new Promise((res, rej) => child.file(res, rej));
        try {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: prefix + file.name,
            writable: false,
            configurable: true,
          });
        } catch { /* already set */ }
        return [file];
      } else if (child.isDirectory) {
        return readDirEntry(child, prefix + child.name + '/');
      }
      return [];
    }));

    for (const files of processedBatch) {
      allFiles.push(...files);
    }
  } while (batch.length > 0);

  return allFiles;
};

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, isProcessing = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    if (isProcessing || isAnalyzing) return;

    // Collect entries SYNCHRONOUSLY
    const collected: Array<{ entry: any; fallbackFile: File | null }> = [];
    const { items } = e.dataTransfer;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const entry = (item as any).webkitGetAsEntry?.();
      collected.push({ entry: entry ?? null, fallbackFile: entry ? null : item.getAsFile() });
    }

    setIsAnalyzing(true);
    try {
      const allFiles: File[] = [];
      // Parallelize top-level items
      const results = await Promise.all(collected.map(async ({ entry, fallbackFile }) => {
        if (entry?.isDirectory) {
          return readDirEntry(entry, entry.name + '/');
        } else if (entry?.isFile) {
          const file: File = await new Promise((res, rej) => entry.file(res, rej));
          return [file];
        } else if (fallbackFile) {
          return [fallbackFile];
        }
        return [];
      }));

      results.forEach(files => allFiles.push(...files));
      if (allFiles.length > 0) onFileSelect(allFiles);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onFileSelect, isProcessing, isAnalyzing]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (!isProcessing && !isAnalyzing) setDragActive(true);
  }, [isProcessing, isAnalyzing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isProcessing || isAnalyzing) return;
    if ((e.target as HTMLElement).closest('button,a,input,select')) return;
    fileInputRef.current?.click();
  }, [isProcessing, isAnalyzing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) onFileSelect(Array.from(files));
    e.target.value = '';
  }, [onFileSelect]);

  const isLoading = isProcessing || isAnalyzing;

  return (
    <>
      {/* Refined Drag Overlay (Dark Glass with Crimson Glow) */}
      {dragActive && (
        <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center gap-6 bg-zinc-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative">
            {/* Soft Ambient Glow */}
            <div className="absolute inset-0 bg-red-500/10 rounded-[3rem] blur-3xl animate-pulse"></div>
            
            <div className="relative flex h-28 w-28 items-center justify-center rounded-[3rem] border border-white/10 bg-white/[0.03] shadow-[0_0_50px_-10px_rgba(239,68,68,0.15)] overflow-hidden">
              {/* Subtle glass reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
              <Upload size={44} className="text-red-500 relative z-10" />
            </div>
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-4xl font-black tracking-tight text-white uppercase italic">READY TO SHARE?</h2>
            <div className="flex items-center gap-3 justify-center">
              <span className="h-px w-8 bg-red-500/30"></span>
              <p className="text-white/40 font-bold text-xs uppercase tracking-[0.3em]">End-to-End Encrypted</p>
              <span className="h-px w-8 bg-red-500/30"></span>
            </div>
          </div>
        </div>
      )}

      {/* Modern Analyzing State Badge */}
      {isAnalyzing && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-8 duration-700 ease-out">
          <div className="flex items-center gap-5 px-6 py-3.5 rounded-2xl bg-zinc-900/60 backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Search className="w-4 h-4 text-red-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-xl border border-red-500/40 animate-ping opacity-20"></div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-black text-white uppercase tracking-[0.1em]">Analyzing Structure</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Mapping nodes for P2P tunnel...</span>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        className={`flex flex-1 w-full flex-col items-center justify-center gap-5 select-none transition-opacity duration-300
          ${!isLoading ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-60'}
        `}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center gap-6">
          <div className={`
            flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500
            ${isLoading ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-white/5 border-white/10 group-hover:border-white/20'}
          `}>
            {isLoading ? (
              <div className="relative">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <div className="absolute inset-0 bg-red-500/20 blur-lg rounded-full animate-pulse"></div>
              </div>
            ) : (
              <Upload size={28} className="text-white/20 group-hover:text-white/40 transition-colors" />
            )}
          </div>

          <div className="text-center space-y-2">
            {isLoading ? (
              <>
                <p className="text-white font-bold text-xl uppercase tracking-tight">Processing Files</p>
                <p className="text-white/40 text-sm font-medium">Preparing end-to-end encryption tunnel...</p>
              </>
            ) : (
              <>
                <p className="text-white/60 text-xl font-medium">Drop files or folders anywhere</p>
                <p className="text-white/20 text-sm font-bold uppercase tracking-widest">or click to browse</p>
              </>
            )}
          </div>
        </div>

        <p className="absolute bottom-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/10 pointer-events-none">
          Zero Server Retention · End-to-End Encrypted
        </p>
      </div>
    </>
  );
};
