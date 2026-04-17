import React, { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    if (isProcessing) return;

    // Collect entries SYNCHRONOUSLY before any await — dataTransfer neutered after first yield
    const collected: Array<{ entry: any; fallbackFile: File | null }> = [];
    const { items } = e.dataTransfer;
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
  }, [onFileSelect, isProcessing]);

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
    if (isProcessing) return;
    // Don't open picker if user clicked a button/link inside
    if ((e.target as HTMLElement).closest('button,a,input,select')) return;
    fileInputRef.current?.click();
  }, [isProcessing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) onFileSelect(Array.from(files));
    e.target.value = '';
  }, [onFileSelect]);

  return (
    <>
      {/* Full-screen drag overlay — fixed so it covers nav too */}
      {dragActive && (
        <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center gap-4 bg-blue-950/70 backdrop-blur-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-blue-400 bg-blue-500/20">
            <Upload size={32} className="text-blue-300" />
          </div>
          <p className="text-2xl font-semibold text-blue-100">Drop to share</p>
          <p className="text-sm text-blue-300/60">End-to-end encrypted · No server storage</p>
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
          ${!isProcessing ? 'cursor-pointer' : 'cursor-default'}
        `}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 border border-white/10">
            <Upload size={24} className="text-white/30" />
          </div>

          {isProcessing ? (
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

        <p className="absolute bottom-6 text-xs text-white/15 pointer-events-none">
          No uploads to our servers · Scout's honour
        </p>
      </div>
    </>
  );
};
