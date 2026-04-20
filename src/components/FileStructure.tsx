import React, { useCallback, useMemo, useState } from 'react';
import { File, Folder, FileText, Image, Video, Music, Archive, Code, ChevronDown, ChevronRight } from 'lucide-react';

interface FileStructureProps {
  files: FileList | File[];
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

  const filesArray = useMemo(() => {
    return Array.isArray(files) ? files : Array.from(files as any as File[]);
  }, [files]);
  const totalFiles = filesArray.length;
  const totalSize = filesArray.reduce((sum, file) => sum + file.size, 0);

  const rootFolder = useMemo(() => {
    if (filesArray.length === 0) return '';
    const first = filesArray[0].webkitRelativePath;
    if (!first) return '';
    const root = first.split('/')[0] || '';
    if (!root) return '';
    for (const f of filesArray) {
      if (!f.webkitRelativePath) return '';
      const r = f.webkitRelativePath.split('/')[0] || '';
      if (r !== root) return '';
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

  const treeRoot = useMemo<TreeNode>(() => {
    const root: TreeNode = { kind: 'dir', name: '__root__', children: new Map() };

    const getParts = (file: File) => {
      const raw = file.webkitRelativePath || file.name;
      const parts = raw.split('/').filter(Boolean);
      if (rootFolder && parts[0] === rootFolder) return parts.slice(1);
      return parts;
    };

    for (const f of filesArray) {
      const parts = getParts(f);
      if (parts.length === 0) continue;

      let cursor = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLeaf = i === parts.length - 1;

        if (isLeaf) {
          cursor.children.set(`file:${part}`, { kind: 'file', name: part, file: f });
          continue;
        }

        const key = `dir:${part}`;
        const existing = cursor.children.get(key);
        if (existing && existing.kind === 'dir') {
          cursor = existing;
        } else {
          const next: TreeNode = { kind: 'dir', name: part, children: new Map() };
          cursor.children.set(key, next);
          cursor = next;
        }
      }
    }

    return root;
  }, [filesArray, rootFolder]);

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
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: depth * 14 }}
        >
          {getFileIcon(node.file.name, node.file.type)}
          <span className="text-white/80 text-sm flex-1 truncate" title={node.file.webkitRelativePath || node.file.name}>
            {node.name}
          </span>
          <span className="text-white/60 text-xs">{formatFileSize(node.file.size)}</span>
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
          className="w-full flex items-center gap-2 py-1 text-left hover:bg-white/5 rounded"
          style={{ paddingLeft: depth * 14 }}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="text-white/50 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-white/50 flex-shrink-0" />
          )}
          <Folder size={16} className="text-blue-400 flex-shrink-0" />
          <span className="text-white/80 text-sm font-medium truncate" title={node.name}>
            {node.name}
          </span>
        </button>
        {isExpanded && (
          <div>
            {children.map((child) => renderNode(child, depth + 1, `${parentKey}/${node.name}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
      style={{ height: maxHeightPx }}
    >
      <div className="h-14 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/80">
            <Folder size={18} className="text-blue-400" />
            <span className="font-medium">
              {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
              {rootFolder ? ` in ${rootFolder}` : ''}
            </span>
          </div>
          <span className="text-white/60 text-sm">{formatFileSize(totalSize)}</span>
        </div>
      </div>

      <div className="px-4 py-2 overflow-y-auto" style={{ height: maxHeightPx - 56 }}>
        {renderNode(treeRoot, 0, 'root')}
      </div>
    </div>
  );
};
