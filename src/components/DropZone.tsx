import React, { useState, useCallback } from 'react';
import { Upload, Folder, File, ArrowLeft, ChevronRight } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (files: File[]) => void;
  isProcessing?: boolean;
}

interface FileSystemItem {
  name: string;
  isDirectory: boolean;
  file?: File;
  entry?: any;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, isProcessing = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);

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
                onFileSelect(files);
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
      onFileSelect(Array.from(files));
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

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && !isProcessing) {
      // Check if it's a directory selection
      if (files.length > 0 && files[0].webkitRelativePath) {
        // Directory was selected - show browser view
        const firstFile = files[0];
        const relativePath = firstFile.webkitRelativePath;
        const pathParts = relativePath.split('/');
        const rootDirName = pathParts[0];
        
        // Create a mock directory entry structure
        const rootItems: FileSystemItem[] = [];
        const processedDirs = new Set<string>();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.webkitRelativePath;
          const pathParts = relativePath.split('/');
          
          // Build directory structure
          let currentPath = '';
          for (let j = 0; j < pathParts.length - 1; j++) {
            const dirName = pathParts[j];
            const fullPath = currentPath ? `${currentPath}/${dirName}` : dirName;
            
            if (!processedDirs.has(fullPath)) {
              rootItems.push({
                name: dirName,
                isDirectory: true,
                entry: { 
                  name: dirName,
                  isDirectory: true,
                  fullPath,
                  files: Array.from(files).filter((f: File) => 
                    f.webkitRelativePath?.startsWith(fullPath + '/')
                  )
                }
              });
              processedDirs.add(fullPath);
            }
            currentPath = fullPath;
          }
          
          // Add file
          rootItems.push({
            name: file.name,
            isDirectory: false,
            file,
            entry: file
          });
        }
        
        // Sort and set items
        const sortedItems = rootItems.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        
        setItems(sortedItems);
        setCurrentPath([rootDirName]);
        setIsBrowsing(true);
      } else {
        // Regular files selected
        onFileSelect(Array.from(files));
      }
    }
  }, [onFileSelect, isProcessing]);

  const navigateToDirectory = useCallback(async (item: FileSystemItem) => {
    if (!item.isDirectory) return;
    
    if (item.entry?.files) {
      // Mock directory from file input
      const subItems: FileSystemItem[] = [];
      const processedDirs = new Set<string>();
      
      for (const file of item.entry.files as File[]) {
        const relativePath = file.webkitRelativePath;
        if (relativePath) {
          const currentDirPath = item.entry.fullPath || '';
          
          // Check if file is in this directory
          if (relativePath.startsWith(currentDirPath + '/')) {
            const remainingPath = relativePath.substring(currentDirPath.length + 1);
            const subPathParts = remainingPath.split('/');
            
            // Build subdirectory structure
            let subCurrentPath = '';
            for (let j = 0; j < subPathParts.length - 1; j++) {
              const dirName = subPathParts[j];
              const fullPath = subCurrentPath ? `${subCurrentPath}/${dirName}` : dirName;
              
              if (!processedDirs.has(fullPath)) {
                subItems.push({
                  name: dirName,
                  isDirectory: true,
                  entry: {
                    name: dirName,
                    isDirectory: true,
                    fullPath: `${currentDirPath}/${fullPath}`,
                    files: Array.from(item.entry.files as File[]).filter((f: File) => 
                      f.webkitRelativePath?.startsWith(`${currentDirPath}/${fullPath}/`)
                    )
                  }
                });
                processedDirs.add(fullPath);
              }
              subCurrentPath = fullPath;
            }
            
            // Add file if it's directly in this directory
            if (subPathParts.length === 1) {
              subItems.push({
                name: file.name,
                isDirectory: false,
                file,
                entry: file
              });
            }
          }
        }
      }
      
      const sortedItems = subItems.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setItems(sortedItems);
      const newPath = [...currentPath, item.name];
      setCurrentPath(newPath);
    }
  }, [currentPath]);

  const navigateBack = useCallback(() => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      // For simplicity, go back to root
      setItems([]);
      setCurrentPath([]);
      setIsBrowsing(false);
    } else {
      // Go back to initial state
      setCurrentPath([]);
      setItems([]);
      setIsBrowsing(false);
    }
  }, [currentPath]);

  const selectCurrentDirectory = useCallback(() => {
    // Collect all files from current directory and subdirectories
    const allFiles: File[] = [];
    
    const collectFiles = (items: FileSystemItem[]) => {
      for (const item of items) {
        if (item.isDirectory && item.entry?.files) {
          collectFiles((item.entry.files as File[]).map((f: File) => ({
            name: f.name,
            isDirectory: false,
            file: f,
            entry: f
          })));
        } else if (item.file) {
          allFiles.push(item.file);
        }
      }
    };
    
    collectFiles(items);
    
    if (allFiles.length > 0) {
      onFileSelect(allFiles);
      setIsBrowsing(false);
      setCurrentPath([]);
      setItems([]);
    }
  }, [items, onFileSelect]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // If browsing, show browser view
  if (isBrowsing) {
    return (
      <div className="w-full p-6 border-2 border-dashed border-white/30 rounded-xl bg-white/5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={navigateBack}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Go back"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div className="flex items-center gap-2 text-white/80">
              <Folder size={18} />
              <span className="font-medium">
                {currentPath.length > 0 ? currentPath.join(' / ') : 'Select Folder'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={selectCurrentDirectory}
              disabled={isProcessing || items.length === 0}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Select This Folder
            </button>
            
            <label className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer">
              <input
                type="file"
                onChange={handleFileInput}
                className="hidden"
                disabled={isProcessing}
                multiple
                {...({ webkitdirectory: '' } as any)}
              />
              Browse
            </label>
          </div>
        </div>

        {/* File List */}
        <div className="min-h-[300px] max-h-[400px] overflow-y-auto">
          <div className="space-y-1">
            {items.map((item, index) => (
              <div
                key={index}
                onClick={() => item.isDirectory && navigateToDirectory(item)}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  item.isDirectory 
                    ? 'hover:bg-white/10 cursor-pointer' 
                    : 'bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 flex-1">
                  {item.isDirectory ? (
                    <ChevronRight size={16} className="text-white/40" />
                  ) : (
                    <div className="w-4" />
                  )}
                  {item.isDirectory ? (
                    <Folder size={18} className="text-blue-400" />
                  ) : (
                    <File size={18} className="text-white/60" />
                  )}
                  <span className="text-white/90">{item.name}</span>
                </div>
                {!item.isDirectory && item.file && (
                  <span className="text-white/50 text-sm">
                    {formatFileSize(item.file.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>
              {items.length} items ({items.filter(i => i.isDirectory).length} folders, {items.filter(i => !i.isDirectory).length} files)
            </span>
            {currentPath.length > 0 && (
              <span>Current: {currentPath.join(' / ')}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Original DropZone UI
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
    </div>
  );
};
