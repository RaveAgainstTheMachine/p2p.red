import type { AdaptiveTransferProgress } from '../services/TransferEngine';

import { FileStructure } from './FileStructure';
import { PinToggle } from './PinToggle';
import { ShareLink } from './ShareLink';
import { EnhancedProgressBar } from './EnhancedProgressBar';
import { formatFileSize } from '../utils/formatUtils';
import { File } from 'lucide-react';
import type { ResumeSession } from '../utils/resumeSessions';

export interface SharePageProps {
  shareLink: string;
  selectedFiles: File[] | null;
  resumeSessions: ResumeSession[];
  refreshResumeSessions: () => void;
  handleResumeSenderSession: (session: ResumeSession) => void;
  handleClearResumeSession: (session: ResumeSession) => void;
  isProcessingFiles: boolean;
  setPin: (pin: string) => void;
  anubisStatusMessage: string | null;
  setSelectedFiles: (files: File[] | null) => void;
  status: string;
  handleProceedWithTransfer: () => void;
  relayLimitWarning: { totalSize: number; isRelay: boolean } | null;
  adaptiveProgress: AdaptiveTransferProgress;
  transferErrorMessage: string;
  isSecure?: boolean;
}

export const SharePage = ({
  shareLink,
  selectedFiles,
  resumeSessions,
  refreshResumeSessions,
  handleResumeSenderSession,
  handleClearResumeSession,
  isProcessingFiles,
  setPin,
  anubisStatusMessage,
  setSelectedFiles,
  status,
  handleProceedWithTransfer,
  relayLimitWarning,
  adaptiveProgress,
  transferErrorMessage,
  isSecure
}: SharePageProps) => {
  return (
              <>
                {/* Idle: Resume sessions on top if any */}
                {!shareLink && !selectedFiles && (
                  <>
                    {resumeSessions.some((session) => session.role === 'sender') && (
                      <div className="glass-card p-8 w-full max-w-2xl mx-auto relative z-10">
                        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                              <div className="text-white font-semibold">Resume a paused send</div>
                              <div className="text-sm text-white/60">Pick up where you left off.</div>
                            </div>
                            <button type="button" onClick={refreshResumeSessions} className="text-sm text-white/60 hover:text-white">Refresh</button>
                          </div>
                          <div className="mt-4 grid gap-3">
                            {resumeSessions.filter((session) => session.role === 'sender').map((session) => (
                              <div key={session.transferId} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-white/90 font-medium truncate">{session.fileName}</div>
                                  <div className="text-xs text-white/60">{formatFileSize(session.fileSize)}</div>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => handleResumeSenderSession(session)} className="px-3 py-1 rounded-lg bg-[var(--theme-primary)] text-white text-sm">Resume</button>
                                  <button type="button" onClick={() => handleClearResumeSession(session)} className="px-3 py-1 rounded-lg bg-white/10 text-sm">Clear</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-center opacity-40 text-xs uppercase tracking-widest font-bold">
                          or drop new files to start fresh
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {isProcessingFiles && (
                  <div className="mt-4 text-center animate-pulse relative z-10">
                    <p className="text-blue-300 font-medium">Processing large file set...</p>
                  </div>
                )}

                {/* File selected: card with details + actions */}
                {!shareLink && selectedFiles && (
                  <div className="glass-card p-8 w-full max-w-2xl mx-auto relative z-10">
                    {selectedFiles.length === 1 ? (
                      <div className="flex items-center justify-center gap-3 text-white/80 mb-6">
                        <File size={20} className="text-[var(--theme-primary)]" />
                        <div className="text-center">
                          <p className="font-medium">{selectedFiles[0].name}</p>
                          <p className="text-sm text-white/60">{formatFileSize(selectedFiles[0].size)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6"><FileStructure files={selectedFiles} /></div>
                    )}
                    <PinToggle onPinChange={setPin} />
                    <div className="flex flex-col gap-4 mt-6">
                      {anubisStatusMessage && (
                        <div className="text-center py-3 px-5 rounded-2xl bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20">
                          <p className="text-[var(--theme-primary)] text-xs font-bold uppercase tracking-widest">{anubisStatusMessage}</p>
                        </div>
                      )}
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => { setSelectedFiles(null); setPin(''); }} className="btn-secondary" disabled={status === 'encrypting'}>Cancel</button>
                        <button onClick={() => handleProceedWithTransfer()} className="btn-primary" disabled={status === 'encrypting'}>
                          {status === 'encrypting' ? 'Warming up...' : 'Share Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Link generated */}
                {shareLink && (
                  <div className="glass-card p-8 w-full max-w-2xl mx-auto">
                    <div className="flex flex-col gap-6">
                      {anubisStatusMessage && (
                        <div className="text-center py-4 px-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-xl backdrop-blur-lg">
                          <p className="text-white/90 text-sm italic">"{anubisStatusMessage}"</p>
                        </div>
                      )}
                      {relayLimitWarning && (
                        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                          <p className="text-amber-200 font-semibold">Relay limit exceeded</p>
                          <p className="text-amber-200/70 text-sm">This transfer is over 100GB.</p>
                        </div>
                      )}
                      <ShareLink shareLink={shareLink} />
                      {status === 'waiting' && (
                        <div className="text-center text-white/60 flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          Waiting for recipient...
                        </div>
                      )}
                      {status === 'transferring' && (
                        <EnhancedProgressBar progress={adaptiveProgress} label="Transferring..." showETA showSpeed isSecure={isSecure} />
                      )}
                      {status === 'complete' && (
                        <div className="text-center text-green-400 font-semibold">Transfer complete!</div>
                      )}
                      {status === 'error' && (
                        <div className="text-center text-red-400">
                          <p>Transfer failed</p>
                          <p className="text-sm text-red-400/70">{transferErrorMessage}</p>

                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
  );
};