import { useState, useRef } from 'react';
import { loadResumeSessionMap, normalizeResumeSessions, type ResumeSession } from '../utils/resumeSessions';

export function useAppState() {
  const [mode, setMode] = useState<'share' | 'receive'>('share');
  const [shareLink, setShareLink] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'waiting' | 'connecting' | 'transferring' | 'complete' | 'error'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [pin, setPin] = useState<string>('');
  const [e2ePinOverride, setE2ePinOverride] = useState<string | null>(null);
  const [senderPeerId, setSenderPeerId] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [pendingReceive, setPendingReceive] = useState<boolean>(false);
  const [incomingFilesList, setIncomingFilesList] = useState<any[] | null>(null);
  const [relayLimitWarning, setRelayLimitWarning] = useState<{ totalSize: number; isRelay: boolean } | null>(null);
  const [incomingFileInfo, setIncomingFileInfo] = useState<{name: string; size: number; expiresAt?: string; fileType?: string} | null>(null);
  const [downloadKey, setDownloadKey] = useState<string | null>(null);
  
  const [resumeSessions, setResumeSessions] = useState<ResumeSession[]>(() => normalizeResumeSessions(loadResumeSessionMap()));
  const [resumeCandidate, setResumeCandidate] = useState<ResumeSession | null>(null);
  const resumeFileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isEncryptedConnection, setIsEncryptedConnection] = useState<boolean>(false);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState<boolean>(false);
  const [requiresPin, setRequiresPin] = useState<boolean>(false);
  const [pinModeOverride, setPinModeOverride] = useState<'pin' | 'passphrase' | null>(null);

  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const globalDragCounter = useRef(0);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const [anubisStatusMessage, setAnubisStatusMessage] = useState<string | null>(null);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<'home' | 'info' | 'legal' | 'landing' | 'feedback'>('home');

  return {
    mode, setMode,
    shareLink, setShareLink,
    status, setStatus,
    selectedFiles, setSelectedFiles,
    pin, setPin,
    e2ePinOverride, setE2ePinOverride,
    senderPeerId, setSenderPeerId,
    fileHandle, setFileHandle,
    pendingReceive, setPendingReceive,
    incomingFilesList, setIncomingFilesList,
    relayLimitWarning, setRelayLimitWarning,
    incomingFileInfo, setIncomingFileInfo,
    downloadKey, setDownloadKey,
    resumeSessions, setResumeSessions,
    resumeCandidate, setResumeCandidate,
    resumeFileInputRef,
    isEncryptedConnection, setIsEncryptedConnection,
    showEncryptionIndicator, setShowEncryptionIndicator,
    requiresPin, setRequiresPin,
    pinModeOverride, setPinModeOverride,
    globalDragActive, setGlobalDragActive,
    isProcessingFiles, setIsProcessingFiles,
    globalDragCounter,
    globalFileInputRef,
    anubisStatusMessage, setAnubisStatusMessage,
    transferErrorMessage, setTransferErrorMessage,
    currentPage, setCurrentPage
  };
}
