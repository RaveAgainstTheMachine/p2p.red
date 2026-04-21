import React, { useState, useCallback, useRef } from 'react';
import { Download } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (files: File[]) => void;
  isProcessing?: boolean;
}

// Recursive dir reader. Handles the 100-entry batch limit by looping readEntries.
const readDirEntry = async (entry: any, prefix = ''): Promise<File[]> => {
  const files: File[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<any[]> =>
    new Promise((res, rej) => reader.readEntries(res, rej));

  let batch: any[];
  do {
    batch = await readBatch();
    for (const child of batch) {
      if (child.isFile) {
        const file: File = await new Promise((res, rej) => child.file(res, rej));
        try {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: prefix + file.name,
            writable: false,
            configurable: true,
          });
        } catch { /* already set */ }
        files.push(file);
      } else if (child.isDirectory) {
        files.push(...await readDirEntry(child, prefix + child.name + '/'));
      }
    }
  } while (batch.length > 0);

  return files;
};

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, isProcessing = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    if (isProcessing || internalProcessing) return;

    // Set internal processing if we suspect this might take a moment
    // (e.g. any directory or multiple items)
    const { items } = e.dataTransfer;
    if (items.length > 5 || Array.from(items).some(item => (item as any).webkitGetAsEntry?.()?.isDirectory)) {
      setInternalProcessing(true);
    }

    try {
      // Collect entries SYNCHRONOUSLY before any await — dataTransfer neutered after first yield
      const collected: Array<{ entry: any; fallbackFile: File | null }> = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const entry = (item as any).webkitGetAsEntry?.();
        collected.push({ entry: entry ?? null, fallbackFile: entry ? null : item.getAsFile() });
      }

      const allFiles: File[] = [];
      for (const { entry, fallbackFile } of collected) {
        if (entry?.isDirectory) {
          allFiles.push(...await readDirEntry(entry, entry.name + '/'));
        } else if (entry?.isFile) {
          const file: File = await new Promise((res, rej) => entry.file(res, rej));
          allFiles.push(file);
        } else if (fallbackFile) {
          allFiles.push(fallbackFile);
        }
      }

      if (allFiles.length > 0) onFileSelect(allFiles);
    } finally {
      setInternalProcessing(false);
    }
  }, [onFileSelect, isProcessing, internalProcessing]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (!isProcessing) setDragActive(true);
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isProcessing || internalProcessing) return;
    // Don't open picker if user clicked a button/link inside
    if ((e.target as HTMLElement).closest('button,a,input,select')) return;
    fileInputRef.current?.click();
  }, [isProcessing, internalProcessing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length > 50) setInternalProcessing(true);
      
      // Use setImmediate/setTimeout to allow UI to update before heavy array conversion/callback
      setTimeout(() => {
        onFileSelect(Array.from(files));
        setInternalProcessing(false);
      }, 10);
    }
    e.target.value = '';
  }, [onFileSelect]);

  return (
    <>
      {/* Full-screen drag overlay — fixed so it covers nav too */}
      {dragActive && (
        <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center gap-4 bg-[var(--theme-bg-1)]/80 backdrop-blur-md">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border-2 border-[var(--theme-primary)] bg-[var(--theme-primary)]/10 shadow-[0_0_50px_var(--theme-glow)]">
            <Download size={40} className="text-[var(--theme-primary)] animate-bounce" />
          </div>
          <p className="text-3xl font-bold text-[var(--theme-primary)]">Drop to share</p>
          <p className="text-sm font-medium opacity-60">End-to-end encrypted · No server storage</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Full-area clickable drop surface */}
      <div
        className={`flex flex-1 w-full flex-col items-center justify-center gap-5 select-none
          ${!(isProcessing || internalProcessing) ? 'cursor-pointer' : 'cursor-default'}
        `}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 shadow-xl transition-transform hover:scale-110 active:scale-95">
            <Download size={32} className="text-[var(--theme-primary)]" />
          </div>

          {(isProcessing || internalProcessing) ? (
            <div className="text-center">
              <p className="text-white/70 font-medium">Processing…</p>
              <p className="text-white/30 text-sm mt-1">Hang tight.</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-white/50 text-lg">Drop files or folders anywhere</p>
              <p className="text-white/25 text-sm mt-1">or click anywhere to browse</p>
            </div>
          )}
        </div>

        <p className="absolute bottom-10 text-[10px] font-bold uppercase tracking-[0.2em] opacity-20 pointer-events-none">
          Your files are encrypted in your browser before sending
        </p>
      </div>
    </>
  );
};
