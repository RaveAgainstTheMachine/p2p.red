import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface FileTypeWarningProps {
  fileName: string;
}

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.app', '.dmg', '.pkg', '.deb', '.rpm', '.sh', '.bash', '.ps1', '.msi'
];

export const FileTypeWarning: React.FC<FileTypeWarningProps> = ({ fileName }) => {
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  const isDangerous = DANGEROUS_EXTENSIONS.includes(extension);

  if (!isDangerous) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={24} className="text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-yellow-400 font-semibold mb-1">
            Potentially Dangerous File Type
          </h4>
          <p className="text-white/80 text-sm mb-2">
            This file has a <code className="bg-white/10 px-1 rounded">{extension}</code> extension, 
            which can execute code on your computer. Only download if you trust the sender.
          </p>
          <ul className="text-white/60 text-xs space-y-1">
            <li>• Verify the sender's identity before downloading</li>
            <li>• Scan the file with antivirus software after download</li>
            <li>• Never run executable files from unknown sources</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
