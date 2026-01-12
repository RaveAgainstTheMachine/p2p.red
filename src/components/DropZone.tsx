import React, { useState, useCallback } from 'react';
import { Upload, Folder } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (files: FileList) => void;
  isProcessing?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, isProcessing = false }) => {
  const [dragActive, setDragActive] = useState(false);

  const readDirectory = async (entry: any, path: string = ''): Promise<File[]> => {
    const files: File[] = [];
    const reader = entry.createReader();
    
    const entries = await new Promise<any[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file((file: File) => resolve(file), reject);
        });
        // Add relative path info
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path + file.name,
          writable: false
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const subFiles = await readDirectory(entry, path + entry.name + '/');
        files.push(...subFiles);
      }
    }
    
    return files;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isProcessing) return;

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      // Check if any item is a directory
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            console.log('Directory detected via drag-drop, reading contents...');
            console.log('Directory name:', entry.name);
            try {
              // Include the root directory name in the path
              const files = await readDirectory(entry, entry.name + '/');
              console.log('Read directory contents:', files.length, 'files');
              if (files.length > 0) {
                onFileSelect(files as any);
                return;
              }
            } catch (error) {
              console.error('Error reading directory:', error);
            }
          }
        }
      }
    }

    // Fallback to regular file handling
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      console.log('Dropped files:', files.length);
      onFileSelect(files);
    }
  }, [onFileSelect, isProcessing]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setDragActive(true);
    }
  }, [isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && !isProcessing) {
      onFileSelect(files);
    }
  }, [onFileSelect, isProcessing]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileCountText = (files: FileList): string => {
    const fileCount = files.length;
    if (fileCount === 1) return '1 file';
    return `${fileCount} files`;
  };

  const getLargestFile = (files: FileList): string => {
    let maxSize = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > maxSize) {
        maxSize = files[i].size;
      }
    }
    return formatFileSize(maxSize);
  };

  const getSelectedFilesText = (files: FileList): string => {
    const fileCount = files.length;
    const largestFile = getLargestFile(files);
    
    if (fileCount === 0) return '';
    
    let text = `${getFileCountText(files)}`;
    
    // Show largest file size if multiple files
    if (fileCount > 1) {
      text += ` (largest: ${largestFile})`;
    }
    
    // Show file types
    const fileTypes = Array.from(files).map(f => f.type || 'unknown');
    const uniqueTypes = [...new Set(fileTypes)];
    if (uniqueTypes.length > 1) {
      text += ` (${uniqueTypes.length} types)`;
    }
    
    return text;
  };

  return (
    <div
      className={`
        relative w-full p-8 border-2 border-dashed rounded-xl
        transition-all duration-300 ease-in-out
        flex flex-col items-center justify-center
        min-h-[200px] cursor-pointer
        ${dragActive 
          ? 'border-blue-400 bg-blue-500/10 scale-[1.02]' 
          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
        }
        ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
        multiple
        {...({ webkitdirectory: '' } as any)}
      />
      
      <Upload 
        size={48} 
        className={`text-white/60 mb-4 transition-transform ${
          dragActive ? 'scale-110' : ''
        }`}
      />
      
      {isProcessing ? (
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
          <p className="text-white/60 text-center mb-4">
            Please wait while we process your files
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-xl font-semibold text-white mb-2">
            Drop files or folders here
          </h3>
          <p className="text-white/60 text-center mb-4">
            or click to browse
          </p>
        </>
      )}
      
      <div className="flex items-center gap-2 text-white/40 text-sm">
        <Folder size={16} />
        <span>Files and folders supported</span>
      </div>
      
      <div className="text-center mt-2 text-white/30 text-xs">
        {isProcessing ? '' : 'Drag and drop multiple files or folders'}
      </div>
      
      <div className="text-center mt-1 text-white/20 text-xs">
        {isProcessing ? '' : getSelectedFilesText({ length: 0 } as FileList)}
      </div>
    </div>
  );
};
