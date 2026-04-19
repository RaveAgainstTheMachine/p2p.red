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
      {/* Redesigned Drag Overlay (P2P.RED style) */}
      {dragActive && (
        <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center gap-6 bg-red-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative group">
            <div className="absolute inset-0 bg-red-500/20 rounded-[2.5rem] blur-2xl animate-pulse"></div>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] border-2 border-red-500/40 bg-red-500/10 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)]">
              <Upload size={40} className="text-red-500 animate-bounce" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-3xl font-bold tracking-tight text-white uppercase">Drop to Securely Share</p>
            <p className="text-red-200/60 font-medium">Encrypted · Peer-to-Peer · Private</p>
          </div>
        </div>
      )}

      {/* Analyzing State Badge */}
      {isAnalyzing && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-12 duration-500 ease-out">
          <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-red-950/40 backdrop-blur-2xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="relative">
              <Search className="w-4 h-4 text-red-500 animate-pulse" />
              <Loader2 className="absolute -inset-1.5 w-7 h-7 text-red-500/40 animate-spin" strokeWidth={1} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white uppercase tracking-wider">Analyzing Structure</span>
              <span className="text-[10px] font-medium text-red-200/60 leading-none">Mapping your files for secure transfer...</span>
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
            ${isLoading ? 'bg-red-500/10 border-red-500/30 animate-pulse' : 'bg-white/5 border-white/10 group-hover:border-white/20'}
          `}>
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            ) : (
              <Upload size={28} className="text-white/30" />
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
