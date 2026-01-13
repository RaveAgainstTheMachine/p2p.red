import React from 'react';
import { File, Folder, FileText, Image, Video, Music, Archive, Code } from 'lucide-react';

interface FileStructureProps {
  files: FileList;
  maxFiles?: number;
}

export const FileStructure: React.FC<FileStructureProps> = ({ files, maxFiles = 10 }) => {
  const getFileIcon = (fileName: string, mimeType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Image files
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(extension || '')) {
      return <Image size={16} className="text-green-400" />;
    }
    
    // Video files
    if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension || '')) {
      return <Video size={16} className="text-purple-400" />;
    }
    
    // Audio files
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension || '')) {
      return <Music size={16} className="text-pink-400" />;
    }
    
    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '') || mimeType.includes('zip')) {
      return <Archive size={16} className="text-yellow-400" />;
    }
    
    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(extension || '')) {
      return <Code size={16} className="text-blue-400" />;
    }
    
    // Text files
    if (mimeType.startsWith('text/') || ['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
      return <FileText size={16} className="text-orange-400" />;
    }
    
    // Default file icon
    return <File size={16} className="text-gray-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const buildFileTree = (fileList: FileList) => {
    const tree: { [key: string]: File[] } = {};
    
    // Group files by folder
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relativePath = file.webkitRelativePath || file.name;
      const pathParts = relativePath.split('/');
      
      if (pathParts.length > 1) {
        // File is in a subfolder
        const folder = pathParts[0];
        if (!tree[folder]) {
          tree[folder] = [];
        }
        tree[folder].push(file);
      } else {
        // File is in root
        if (!tree['/']) {
          tree['/'] = [];
        }
        tree['/'].push(file);
      }
    }
    
    return tree;
  };

  const fileTree = buildFileTree(files);
  const totalFiles = files.length;
  const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
  const hasMore = totalFiles > maxFiles;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl max-h-64 overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/10 backdrop-blur-md border-b border-white/10 p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder size={18} className="text-blue-400" />
            <span className="text-white font-medium">
              {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
            </span>
          </div>
          <span className="text-white/60 text-sm">
            {formatFileSize(totalSize)}
          </span>
        </div>
      </div>

      {/* Scrollable File Tree */}
      <div className="p-4 pt-3 max-h-56 overflow-y-auto">
        <div className="space-y-1">
          {Object.entries(fileTree).map(([folder, folderFiles]) => (
            <div key={folder}>
              {folder !== '/' && (
                <div className="flex items-center gap-2 py-1">
                  <Folder size={14} className="text-blue-300" />
                  <span className="text-white/80 text-sm font-medium">
                    {folder}
                  </span>
                  <span className="text-white/50 text-xs">
                    ({folderFiles.length} {folderFiles.length === 1 ? 'file' : 'files'})
                  </span>
                </div>
              )}
            
            {/* Files in folder/root */}
            <div className={folder !== '/' ? 'ml-4' : ''}>
              {folderFiles.slice(0, maxFiles - (folder !== '/' ? 1 : 0)).map((file, index) => (
                <div key={index} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded transition-colors">
                  {getFileIcon(file.name, file.type)}
                  <span className="text-white/70 text-sm flex-1 truncate" title={file.name}>
                    {file.webkitRelativePath ? 
                      (folder !== '/' ? file.webkitRelativePath.split('/').slice(1).join('/') : file.webkitRelativePath) 
                      : file.name
                    }
                  </span>
                  <span className="text-white/50 text-xs">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {hasMore && (
          <div className="text-center py-2">
            <span className="text-white/50 text-sm">
              ... and {totalFiles - maxFiles} more files
            </span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
