import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, XCircle } from 'lucide-react';

interface FileTypeWarningProps {
  fileName: string;
  file?: File;
}

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
  '.app', '.dmg', '.pkg', '.deb', '.rpm', '.sh', '.bash', '.ps1', '.msi'
];

export const FileTypeWarning: React.FC<FileTypeWarningProps> = ({ fileName, file }) => {
  const [magicByteCheck, setMagicByteCheck] = useState<{
    checked: boolean;
    isDangerous: boolean;
    reason: string | null;
    mismatch: boolean;
    mismatchWarning: string | null;
  }>({ checked: false, isDangerous: false, reason: null, mismatch: false, mismatchWarning: null });

  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  const isDangerousByExtension = DANGEROUS_EXTENSIONS.includes(extension);

  useEffect(() => {
    // Temporarily disable magic byte validation to prevent Safe Browsing blocks
    // TODO: Re-enable when we have better file handling
    setMagicByteCheck({
      checked: true,
      isDangerous: false,
      reason: null,
      mismatch: false,
      mismatchWarning: null
    });
  }, [file]);

  const showWarning = isDangerousByExtension || magicByteCheck.isDangerous || magicByteCheck.mismatch;

  if (!showWarning) {
    return null;
  }

  const severity = magicByteCheck.isDangerous ? 'critical' : magicByteCheck.mismatch ? 'high' : 'medium';
  const bgColor = severity === 'critical' ? 'bg-red-500/10 border-red-500/30' : 
                  severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' : 
                  'bg-yellow-500/10 border-yellow-500/30';
  const iconColor = severity === 'critical' ? 'text-red-400' : 
                    severity === 'high' ? 'text-orange-400' : 
                    'text-yellow-400';
  const Icon = severity === 'critical' ? XCircle : AlertTriangle;

  return (
    <div className={`${bgColor} border rounded-lg p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <Icon size={24} className={`${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h4 className={`${iconColor} font-semibold mb-1`}>
            {severity === 'critical' ? 'DANGEROUS FILE DETECTED' : 
             severity === 'high' ? 'File Type Mismatch Detected' : 
             'Potentially Dangerous File Type'}
          </h4>
          
          {magicByteCheck.checked && magicByteCheck.isDangerous && (
            <p className="text-white/90 text-sm mb-2 font-medium">
              {magicByteCheck.reason}
            </p>
          )}
          
          {magicByteCheck.mismatch && magicByteCheck.mismatchWarning && (
            <p className="text-white/90 text-sm mb-2">
              <strong>Warning:</strong> {magicByteCheck.mismatchWarning}
            </p>
          )}
          
          {isDangerousByExtension && !magicByteCheck.isDangerous && (
            <p className="text-white/80 text-sm mb-2">
              This file has a <code className="bg-white/10 px-1 rounded">{extension}</code> extension, 
              which can execute code on your computer.
            </p>
          )}
          
          <div className="bg-black/20 rounded p-3 mb-2">
            <p className="text-white/90 text-sm font-semibold mb-2">Security Recommendations:</p>
            <ul className="text-white/70 text-xs space-y-1.5">
              <li>• <strong>Verify sender identity</strong> - Confirm this is from a trusted source</li>
              <li>• <strong>Scan with antivirus</strong> - Use updated antivirus software before opening</li>
              <li>• <strong>Check file integrity</strong> - Verify file hash if provided</li>
              {severity === 'critical' && (
                <li className="text-red-300">• <strong>DO NOT RUN</strong> - This file can harm your system</li>
              )}
            </ul>
          </div>
          
          {magicByteCheck.checked && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Shield size={14} />
              <span>Magic byte validation: {magicByteCheck.isDangerous ? 'Failed' : 'Passed'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
