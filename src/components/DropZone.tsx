import React, { useState, useCallback } from 'react';
import { Upload, Folder, File, ArrowLeft, ChevronRight, HardDrive } from 'lucide-react';

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
  const [showFolderSelection, setShowFolderSelection] = useState(false);

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
        const processedFiles = new Set<string>();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.webkitRelativePath;
          const pathParts = relativePath.split('/');
          
          console.log('Processing file:', relativePath, 'pathParts:', pathParts, 'length:', pathParts.length);
          
          // Build directory structure - only add directories that are direct children of root
          if (pathParts.length > 2) { // Only if there are subdirectories beyond the root
            const dirName = pathParts[1]; // Only process first level subdirectories
            const fullPath = dirName;
            
            if (!processedDirs.has(fullPath)) {
              rootItems.push({
                name: dirName,
                isDirectory: true,
                entry: { 
                  name: dirName,
                  isDirectory: true,
                  fullPath,
                  files: Array.from(files).filter((f: File) => 
                    f.webkitRelativePath?.startsWith(rootDirName + '/' + fullPath + '/')
                  )
                }
              });
              processedDirs.add(fullPath);
            }
          }
          
          // Add file only if it's directly in the root directory (no subdirectories)
          if (pathParts.length === 2) { // Only root level files: "foldername/filename.ext"
            const fileKey = relativePath;
            if (!processedFiles.has(fileKey)) {
              rootItems.push({
                name: file.name,
                isDirectory: false,
                file,
                entry: file
              });
              processedFiles.add(fileKey);
            }
          }
        }
        
        // Add the root folder itself as a directory entry if we haven't added any subdirectories
        if (processedDirs.size === 0 && processedFiles.size > 0) {
          // This means we have files directly in the root folder, so show the root folder
          // But we're already IN the root folder, so we don't need to show it as a subdirectory
          // The UI should show we're browsing the root folder with its contents
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
      const processedFiles = new Set<string>();
      const currentDirPath = item.entry.fullPath || '';
      
      for (const file of item.entry.files as File[]) {
        const relativePath = file.webkitRelativePath;
        if (relativePath) {
          // Check if file is in this directory
          if (relativePath.startsWith(currentDirPath + '/')) {
            const remainingPath = relativePath.substring(currentDirPath.length + 1);
            const subPathParts = remainingPath.split('/');
            
            console.log('Navigating file:', relativePath, 'remainingPath:', remainingPath, 'subPathParts:', subPathParts, 'length:', subPathParts.length);
            
            // Build subdirectory structure - only direct children
            if (subPathParts.length > 1) { // Only if there are subdirectories
              const dirName = subPathParts[0]; // Only first level subdirectory
              const fullPath = dirName;
              
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
            }
            
            // Add file only if it's directly in this directory
            if (subPathParts.length === 1) { // Only files directly in this directory
              const fileKey = relativePath;
              if (!processedFiles.has(fileKey)) {
                subItems.push({
                  name: file.name,
                  isDirectory: false,
                  file,
                  entry: file
                });
                processedFiles.add(fileKey);
              }
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

  const handleBrowseClick = useCallback(() => {
    setShowFolderSelection(true);
  }, []);

  const handleFolderDialogSelect = useCallback(() => {
    // Trigger the actual file selection
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFileInput(e as any);
      }
      setShowFolderSelection(false);
    };
    input.click();
  }, [handleFileInput]);

  const handleFolderDialogCancel = useCallback(() => {
    setShowFolderSelection(false);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalSize = useCallback((): number => {
    return items
      .filter(item => !item.isDirectory && item.file)
      .reduce((total, item) => total + (item.file?.size || 0), 0);
  }, [items]);

  // Folder Selection View (inline, no modal)
  if (showFolderSelection) {
    return (
      <div className="w-full p-8 border-2 border-dashed border-white/30 rounded-xl bg-white/5">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 max-w-md w-full">
            <div className="flex items-center gap-3 text-white/80 mb-2">
              <HardDrive size={20} className="text-blue-400" />
              <span className="font-medium">Choose files to share</span>
            </div>
            <p className="text-white/60 text-sm">
              Select one or more files to share. You can also drag and drop folders anytime.
            </p>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 max-w-md w-full">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
              <div className="text-white/70 text-sm">
                <p className="font-medium text-white mb-1">Privacy First</p>
                <p>Your files never leave your device until someone connects directly to receive them.</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleFolderDialogCancel}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFolderDialogSelect}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
            >
              Choose Files
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            
            <button
              onClick={handleBrowseClick}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* File List with Locked Header */}
        <div className="flex flex-col h-[400px] relative">
          {/* Locked Header */}
          <div className="bg-white/5 border-b border-white/10 px-4 py-3 sticky top-0 z-10">
            <div className="flex items-center justify-between text-white/80 text-sm">
              <span className="font-medium">
                {currentPath.length > 0 ? (
                  <>
                    {currentPath.length} folder{currentPath.length > 1 ? 's' : ''} 
                    {items.filter(i => !i.isDirectory).length > 0 && `, ${items.filter(i => !i.isDirectory).length} file${items.filter(i => !i.isDirectory).length > 1 ? 's' : ''}`}
                  </>
                ) : (
                  <>
                    {items.filter(i => !i.isDirectory).length} file{items.filter(i => !i.isDirectory).length > 1 ? 's' : ''}
                    {items.filter(i => i.isDirectory).length > 0 && `, ${items.filter(i => i.isDirectory).length} folder${items.filter(i => i.isDirectory).length > 1 ? 's' : ''}`}
                  </>
                )}
              </span>
              <span className="text-white/60">
                Total: {formatFileSize(calculateTotalSize())}
              </span>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
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
      onClick={handleBrowseClick}
    >
      
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
      
      <div className="mt-auto inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
        <span>Files are never uploaded to our servers.</span>
      </div>
    </div>
  );
};
