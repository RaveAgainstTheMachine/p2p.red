import type { AdaptiveTransferProgress } from '../services/TransferEngine';
import { FileStructure } from './FileStructure';
import { EnhancedProgressBar } from './EnhancedProgressBar';
import { formatFileSize } from '../utils/formatUtils';
import { FileTypeWarning } from './FileTypeWarning';
import { Download } from 'lucide-react';
import type { ResumeSession } from '../utils/resumeSessions';

export interface ReceivePageProps {
  resumeSessions: ResumeSession[];
  matchesIncomingResume: (session: ResumeSession) => boolean;
  pendingReceive: boolean;
  handleChooseSaveLocation: () => void;
  handleClearResumeSession: (session: ResumeSession) => void;
  status: string;
  adaptiveProgress: AdaptiveTransferProgress;
  incomingFileInfo: {name: string; size: number; expiresAt?: string; fileType?: string} | null;
  incomingFilesList: Array<{ name: string; size: number; type: string; webkitRelativePath?: string }> | null;
  transferErrorMessage: string;
  isSecure?: boolean;
}

export const ReceivePage = ({
  resumeSessions,
  matchesIncomingResume,
  pendingReceive,
  handleChooseSaveLocation,
  handleClearResumeSession,
  status,
  adaptiveProgress,
  incomingFileInfo,
  incomingFilesList,
  transferErrorMessage,
  isSecure
}: ReceivePageProps) => {
  return (
              <div className="glass-card p-8 w-full max-w-2xl mx-auto">
                <div>
                  {resumeSessions.some((session) => session.role === 'receiver' && matchesIncomingResume(session)) && !pendingReceive && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="text-white font-semibold">Resume detected</div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={handleChooseSaveLocation} className="btn-primary">Resume</button>
                        <button onClick={() => {
                          const match = resumeSessions.find(s => s.role === 'receiver' && matchesIncomingResume(s));
                          if (match) void handleClearResumeSession(match);
                        }} className="btn-secondary">Clear</button>
                      </div>
                    </div>
                  )}
                  {status === 'connecting' && (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-white/80">Connecting...</p>
                    </div>
                  )}
                  {status === 'transferring' && (
                    <EnhancedProgressBar progress={adaptiveProgress} label="Receiving..." showETA showSpeed isSecure={isSecure} />
                  )}
                  {status === 'complete' && (
                    <div className="text-center text-green-400 font-semibold">Download complete!</div>
                  )}
                  {pendingReceive && incomingFileInfo && (
                    <div className="animate-fade-up">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/20 text-2xl">📁</div>
                          <div className="flex-1">
                            <p className="text-white font-semibold truncate">{incomingFileInfo.name}</p>
                            <span className="text-white/50 text-sm">{formatFileSize(incomingFileInfo.size)}</span>
                          </div>
                        </div>
                        {incomingFilesList && incomingFilesList.length > 0 && (
                          <div className="mt-4 border-t border-white/5 pt-4 text-left">
                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-3">Files in this share:</p>
                            <FileStructure files={incomingFilesList as any} />
                          </div>
                        )}
                        <div className="mt-4 text-center">
                          <FileTypeWarning fileName={incomingFileInfo.name} />
                        </div>
                      </div>
                      <button onClick={handleChooseSaveLocation} className="w-full py-4 bg-[var(--theme-primary)] text-white rounded-2xl font-semibold shadow-lg">
                        <Download size={20} className="inline mr-2" />
                        Download
                      </button>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="text-center text-red-400">
                      <p>Download failed</p>
                      <p className="text-sm text-red-400/70">{transferErrorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
  );
};