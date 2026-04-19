import React, { useCallback, useMemo, useState } from 'react';
import { File, Folder, FileText, Image, Video, Music, Archive, Code, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface FileStructureProps {
  files: FileList | File[];
  maxFiles?: number;
}

export const FileStructure: React.FC<FileStructureProps> = ({ files, maxFiles = 10 }) => {

  const getFileIcon = (fileName: string, mimeType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(extension || '')) {
      return <Image size={16} className="text-emerald-400" />;
    }
    if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension || '')) {
      return <Video size={16} className="text-purple-400" />;
    }
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension || '')) {
      return <Music size={16} className="text-pink-400" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '') || mimeType.includes('zip')) {
      return <Archive size={16} className="text-yellow-400" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(extension || '')) {
      return <Code size={16} className="text-blue-400" />;
    }
    if (mimeType.startsWith('text/') || ['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
      return <FileText size={16} className="text-orange-400" />;
    }
    return <File size={16} className="text-white/20" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filesArray = useMemo(() => {
    return Array.isArray(files) ? files : Array.from(files as any as File[]);
  }, [files]);
  
  const totalFiles = filesArray.length;
  const totalSize = useMemo(() => filesArray.reduce((sum, file) => sum + file.size, 0), [filesArray]);

  const rootFolder = useMemo(() => {
    if (filesArray.length === 0) return '';
    const first = filesArray[0].webkitRelativePath;
    if (!first) return '';
    const root = first.split('/')[0] || '';
    if (!root) return '';
    // Quick check: if any file doesn't start with this root, there is no common root
    const sampleSize = Math.min(10, filesArray.length);
    for (let i = 0; i < sampleSize; i++) {
       const f = filesArray[i];
       if (!f.webkitRelativePath?.startsWith(root + '/')) return '';
    }
    return root;
  }, [filesArray]);

  type TreeNode =
    | {
        kind: 'dir';
        name: string;
        children: Map<string, TreeNode>;
      }
    | {
        kind: 'file';
        name: string;
        file: File;
      };

  // Skip deep tree building for extremely large sets to keep UI responsive
  const isLargeSet = totalFiles > 500;

  const treeRoot = useMemo<TreeNode | null>(() => {
    if (isLargeSet) return null;

    const root: TreeNode = { kind: 'dir', name: '__root__', children: new Map() };
    const rootPrefix = rootFolder ? rootFolder + '/' : '';

    for (const f of filesArray) {
      const path = f.webkitRelativePath || f.name;
      const relativePath = rootPrefix && path.startsWith(rootPrefix) 
        ? path.slice(rootPrefix.length) 
        : path;
      
      const parts = relativePath.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      let cursor = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;

        if (isLeaf) {
          cursor.children.set(`f:${part}`, { kind: 'file', name: part, file: f });
        } else {
          const key = `d:${part}`;
          let next = cursor.children.get(key);
          if (!next || next.kind !== 'dir') {
            next = { kind: 'dir', name: part, children: new Map() };
            cursor.children.set(key, next);
          }
          cursor = next as any;
        }
      }
    }
    return root;
  }, [filesArray, rootFolder, isLargeSet]);

  const maxHeightPx = useMemo(() => {
    const headerPx = 56;
    const rowPx = 28;
    const rows = Math.max(6, Math.min(20, maxFiles));
    return headerPx + rows * rowPx;
  }, [maxFiles]);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const toggleDir = useCallback((dirId: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirId)) next.delete(dirId);
      else next.add(dirId);
      return next;
    });
  }, []);

  const renderNode = (node: TreeNode, depth: number, parentKey: string) => {
    if (node.kind === 'file') {
      return (
        <div
          key={`${parentKey}/f:${node.name}`}
          className="flex items-center gap-3 py-1.5 group"
          style={{ paddingLeft: depth * 14 + 16 }}
        >
          <div className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
            {getFileIcon(node.file.name, node.file.type)}
          </div>
          <span className="text-white/60 text-[13px] font-medium flex-1 truncate" title={node.file.webkitRelativePath || node.file.name}>
            {node.name}
          </span>
          <span className="text-white/20 text-[11px] font-bold tracking-tighter uppercase mr-2">{formatFileSize(node.file.size)}</span>
        </div>
      );
    }

    const children = Array.from(node.children.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    if (node.name === '__root__') {
      return (
        <div key={`${parentKey}/d:${node.name}`}>
          {children.map((child) => renderNode(child, depth, parentKey))}
        </div>
      );
    }

    const dirId = `${parentKey}/d:${node.name}`;
    const isExpanded = expandedDirs.has(dirId);

    return (
      <div key={dirId} className="py-0.5">
        <button
          type="button"
          onClick={() => toggleDir(dirId)}
          className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-white/5 rounded transition-colors"
          style={{ paddingLeft: depth * 14 + 4 }}
          aria-expanded={isExpanded}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown size={14} className="text-white/30" />
            ) : (
              <ChevronRight size={14} className="text-white/30" />
            )}
          </div>
          <Folder size={16} className="text-red-500/60 flex-shrink-0" />
          <span className="text-white/80 text-[13px] font-bold truncate">
            {node.name}
          </span>
          <span className="ml-auto mr-2 text-[10px] font-bold text-white/10 uppercase tracking-widest">{node.children.size} items</span>
        </button>
        {isExpanded && (
          <div className="border-l border-white/5 ml-3">
            {children.map((child) => renderNode(child, depth + 1, `${parentKey}/${node.name}`))}
          </div>
        )}
      </div>
    );
  };

  const folderCount = useMemo(() => {
    if (!isLargeSet) return 0;
    const folders = new Set<string>();
    for (const f of filesArray) {
      if (f.webkitRelativePath) {
        const path = f.webkitRelativePath;
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash !== -1) {
          const dir = path.substring(0, lastSlash);
          folders.add(dir);
          // Also add parent folders
          let parentSlash = dir.lastIndexOf('/');
          let currentDir = dir;
          while (parentSlash !== -1) {
            currentDir = currentDir.substring(0, parentSlash);
            folders.add(currentDir);
            parentSlash = currentDir.lastIndexOf('/');
          }
        }
      }
    }
    return folders.size;
  }, [filesArray, isLargeSet]);

  return (
    <div
      className="bg-red-950/5 border border-white/5 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm"
      style={{ height: maxHeightPx }}
    >
      <div className="h-14 border-b border-white/5 px-6 py-3 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
               <Folder size={16} className="text-red-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight">
                {totalFiles} {totalFiles === 1 ? 'File' : 'Files'} Selected
              </span>
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest truncate max-w-[200px]">
                {rootFolder || 'Individual Files'}
              </span>
            </div>
          </div>
          <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span className="text-white/60 text-[11px] font-bold">{formatFileSize(totalSize)}</span>
          </div>
        </div>
      </div>

      <div className="px-2 py-3 overflow-y-auto custom-scrollbar" style={{ height: maxHeightPx - 56 }}>
        {isLargeSet ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 rotate-3">
                <Folder size={32} className="text-red-500/40" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30 -rotate-6 backdrop-blur-md">
                <Info size={20} className="text-red-500" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-white font-bold text-base">Large File Set Detected</h3>
                <p className="text-white/40 text-[11px] leading-relaxed max-w-[240px] mx-auto">
                  For optimal speed, the detailed file tree is hidden for large transfers. All items remain queued for secure delivery.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-white/20 text-[9px] font-bold uppercase tracking-widest">Total Files</span>
                  <span className="text-white font-bold text-lg leading-none">{totalFiles.toLocaleString()}</span>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-white/20 text-[9px] font-bold uppercase tracking-widest">Total Folders</span>
                  <span className="text-white font-bold text-lg leading-none">{folderCount > 0 ? folderCount.toLocaleString() : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : treeRoot ? (
          renderNode(treeRoot, 0, 'root')
        ) : null}
      </div>
    </div>
  );
};
