import React, { useState, useCallback } from 'react';
import { Folder, File, ArrowLeft, ChevronRight, Upload } from 'lucide-react';

interface FileBrowserProps {
  onFileSelect: (files: File[]) => void;
  isProcessing?: boolean;
}

interface FileSystemItem {
  name: string;
  isDirectory: boolean;
  file?: File;
  entry?: any;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ onFileSelect, isProcessing = false }) => {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [history, setHistory] = useState<string[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && !isProcessing) {
      // Check if it's a directory selection
      if (files.length > 0 && files[0].webkitRelativePath) {
        // Directory was selected - show first directory
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
        setHistory([[rootDirName]]);
        setHistoryIndex(0);
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
      
      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPath);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [currentPath, history, historyIndex]);

  const navigateBack = useCallback(() => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      
      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPath);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      // Rebuild items for parent directory (simplified - would need proper state management)
      // For now, just go back to root
      setItems([]);
      setCurrentPath([]);
    }
  }, [currentPath, history, historyIndex]);

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
    }
  }, [items, onFileSelect]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full p-6 border-2 border-dashed border-white/30 rounded-xl bg-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {currentPath.length > 0 && (
            <button
              onClick={navigateBack}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Go back"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
          )}
          <div className="flex items-center gap-2 text-white/80">
            <Folder size={18} />
            <span className="font-medium">
              {currentPath.length > 0 ? currentPath.join(' / ') : 'Select Folder'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {currentPath.length > 0 && (
            <button
              onClick={selectCurrentDirectory}
              disabled={isProcessing || items.length === 0}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Select This Folder
            </button>
          )}
          
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
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-white/60">
            <Upload size={48} className="mb-4 opacity-50" />
            <p className="text-center">
              Click "Browse" to select a folder<br />
              or drag and drop files here
            </p>
          </div>
        ) : (
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
        )}
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
};
