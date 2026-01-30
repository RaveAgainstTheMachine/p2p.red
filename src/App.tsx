import { useState, useEffect, useRef } from 'react';
import type { DataConnection } from 'peerjs';
import { useWebRTC } from './hooks/useWebRTC';
import { useEncryption } from './hooks/useEncryption';
import { useFileTransfer } from './hooks/useFileTransfer';
import { useAdaptiveMultiStreamTransfer } from './hooks/useAdaptiveMultiStreamTransfer';
import { DropZone } from './components/DropZone';
import { EnhancedProgressBar } from './components/EnhancedProgressBar';
import { EncryptionIndicator } from './components/EncryptionIndicator';
import { FileTypeWarning } from './components/FileTypeWarning';
import { CookieBanner } from './components/CookieBanner';
import { Monitoring } from './components/Monitoring';
import { FileStructure } from './components/FileStructure';
import { Logo } from './components/Logo';
import { PinVerification } from './components/PinVerification';
import { PinToggle } from './components/PinToggle';
import { ShareLink } from './components/ShareLink';
import { Download, Share2, Shield, CheckCircle, File, Check, Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { createShortLink, getMetadata } from './services/metadataApi';
import { formatExpirationTime } from './utils/timeFormat';
import { Info } from './pages/Info';
import { Legal } from './pages/Legal';
import { Landing } from './pages/Landing';
import { clearTransfer } from './utils/shardStore';

// Meta tag management for rich link previews
const updateMetaTags = (metadata: any) => {
  console.log('🏷️ Updating meta tags for:', metadata);
  
  // Update title
  document.title = `${metadata.fileName} - P2P File Share`;
  console.log('📝 Updated title:', document.title);
  
  // Update or create Open Graph meta tags
  const updateMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
      console.log('➕ Created meta tag:', property);
    }
    tag.content = content;
    console.log('🏷️ Updated meta tag:', property, '=', content);
  };

  const updateMetaName = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
      console.log('➕ Created meta name:', name);
    }
    tag.content = content;
    console.log('🏷️ Updated meta name:', name, '=', content);
  };
  
  // Update Open Graph tags
  updateMetaTag('og:type', 'website');
  updateMetaTag('og:url', `${window.location.origin}${window.location.pathname}${window.location.hash}`);
  updateMetaTag('og:title', `${metadata.fileName} - Shared via P2P`);
  updateMetaTag('og:description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption. Download directly from sender.`);
  updateMetaTag('og:site_name', 'p2p.red');
  
  // Add image for better preview (optional)
  updateMetaTag('og:image', `${window.location.origin}/favicon.svg`);
  updateMetaTag('og:image:width', '256');
  updateMetaTag('og:image:height', '256');
  
  // Update Twitter Card tags
  updateMetaName('twitter:card', 'summary_large_image');
  updateMetaName('twitter:url', `${window.location.origin}${window.location.pathname}${window.location.hash}`);
  updateMetaName('twitter:title', `${metadata.fileName} - Shared via P2P`);
  updateMetaName('twitter:description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption.`);
  updateMetaName('twitter:image', `${window.location.origin}/favicon.svg`);
  
  // Update basic meta description
  updateMetaName('description', `A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.`);
  
  console.log('✅ Meta tags updated successfully');
};

const resetMetaTags = () => {
  // Reset to default meta tags
  document.title = 'P2P File Share - Secure Peer-to-Peer File Sharing';
  
  const updateMetaTag = (property: string, content: string) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (tag) {
      tag.content = content;
    }
  };

  const updateMetaName = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (tag) {
      tag.content = content;
    }
  };
  
  // Reset Open Graph tags
  updateMetaTag('og:type', 'website');
  updateMetaTag('og:url', 'https://p2p.red/');
  updateMetaTag('og:title', 'P2P File Share - Secure File Sharing');
  updateMetaTag('og:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  updateMetaTag('og:site_name', 'p2p.red');
  
  // Reset Twitter Card tags
  updateMetaName('twitter:card', 'summary');
  updateMetaName('twitter:url', 'https://p2p.red/');
  updateMetaName('twitter:title', 'P2P File Share - Secure File Sharing');
  updateMetaName('twitter:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  
  // Reset basic meta description
  updateMetaName('description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage, no tracking.');
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const RELAY_SIZE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024;
const RESUME_SESSION_KEY = 'p2p_resume_sessions_v1';

interface ResumeSession {
  transferId: string;
  role: 'sender' | 'receiver';
  fileName: string;
  fileSize: number;
  lastModified?: number;
  shardSize: number;
  shardCount: number;
  completedShardIds: number[];
  updatedAt: number;
  status: 'in_progress' | 'complete';
}

const loadResumeSessionMap = (): Record<string, ResumeSession> => {
  try {
    const raw = localStorage.getItem(RESUME_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ResumeSession>;
  } catch {
    return {};
  }
};

const saveResumeSessionMap = (sessions: Record<string, ResumeSession>) => {
  try {
    localStorage.setItem(RESUME_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
};

const removeResumeSession = (transferId: string) => {
  const sessions = loadResumeSessionMap();
  if (!sessions[transferId]) return;
  delete sessions[transferId];
  saveResumeSessionMap(sessions);
};

const normalizeResumeSessions = (sessions: Record<string, ResumeSession>) => {
  return Object.values(sessions)
    .filter((session) => session.status === 'in_progress')
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

function App() {
  const { peer, peerId, isConnected, connectionState, isOnline, initializePeer, connectToPeer } = useWebRTC();
  const { isEncrypting } = useEncryption();
  const { transferProgress, isTransferring, resumeTransfer } = useFileTransfer();
  const { transferProgress: adaptiveProgress, transferFileAdaptive, prepareDownloadBridge } = useAdaptiveMultiStreamTransfer();
 
  const isAssistedConnection = (() => {
    const ct = (adaptiveProgress as any)?.candidateType;
    return typeof ct === 'string' && ct.toLowerCase().includes('relay');
  })();
  const [mode, setMode] = useState<'share' | 'receive'>('share');
  const [shareLink, setShareLink] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'waiting' | 'connecting' | 'transferring' | 'complete' | 'error'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [pin, setPin] = useState<string>('');
  const [e2ePinOverride, setE2ePinOverride] = useState<string | null>(null);
  const [senderPeerId, setSenderPeerId] = useState<string | null>(null);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [pendingReceive, setPendingReceive] = useState<boolean>(false);
  const [incomingFileInfo, setIncomingFileInfo] = useState<{name: string; size: number; expiresAt?: string; fileType?: string} | null>(null);
  const [downloadKey, setDownloadKey] = useState<string | null>(null);
  const [resumeSessions, setResumeSessions] = useState<ResumeSession[]>(() => normalizeResumeSessions(loadResumeSessionMap()));
  const [resumeCandidate, setResumeCandidate] = useState<ResumeSession | null>(null);
  const resumeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEncryptedConnection, setIsEncryptedConnection] = useState<boolean>(false);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState<boolean>(false);
  const [requiresPin, setRequiresPin] = useState<boolean>(false);
  const [pinModeOverride, setPinModeOverride] = useState<'pin' | 'passphrase' | null>(null);
  const [pinError, setPinError] = useState<string>('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>(undefined);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'landing' | 'home' | 'legal' | 'info'>(
    window.location.hash ? 'home' : 'landing'
  );
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme;
    }
    return 'system';
  });
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeToggleRef = useRef<HTMLDivElement | null>(null);
  const [showClipboardNotification, setShowClipboardNotification] = useState<boolean>(false);
  const [anubisStatusMessage, setAnubisStatusMessage] = useState<string | null>(null);
  const [humanToastMessage, setHumanToastMessage] = useState<string | null>(null);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string>('');
  const [isFaqExpanded, setIsFaqExpanded] = useState<boolean>(false);
  const [anubisChallenge, setAnubisChallenge] = useState<{ active: boolean; url?: string }>({
    active: false
  });
  const anubisStatusTimeout = useRef<number | null>(null);
  const humanToastTimeout = useRef<number | null>(null);
  const antiBotMessages = [
    'Quick bot check — please hold, carbon-based lifeform.',
    'Verifying you’re human. Sorry, robots ruined it for everyone.',
    'Anti-bot scan running. If you’re a toaster, now’s the time to confess.',
    'Confirming you’re not a swarm of polite Canadian geese.',
    'Bot-detector warming up. Please sip maple syrup and wait.'
  ];
  const humanMessages = [
    'Well done being a human! Share link ready.',
    'Certified organic human ✅ Your link is ready.',
    'Humans 1, bots 0. Share link created.',
    'Thanks for proving you’re not a Roomba. Link generated.',
    'You passed the Turing, eh? Share link ready.'
  ];
  const buildVariantRaw = (import.meta as any)?.env?.VITE_BUILD_VARIANT?.toLowerCase?.();
  const buildVariant = buildVariantRaw || 'dev';
  const buildVersion = (import.meta as any)?.env?.VITE_BUILD_VERSION;
  const formatBuildVersion = (version?: string) => {
    if (!version) return version;
    const parts = version.split('-');
    const timestamp = parts[parts.length - 1];
    if (!/^[0-9]{14}$/.test(timestamp)) return version;
    const year = Number(timestamp.slice(0, 4));
    const month = Number(timestamp.slice(4, 6)) - 1;
    const day = Number(timestamp.slice(6, 8));
    const hour = Number(timestamp.slice(8, 10));
    const minute = Number(timestamp.slice(10, 12));
    const second = Number(timestamp.slice(12, 14));
    const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
    const estTimestamp = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(utcDate);
    return `${parts.slice(0, -1).join('-')}-${estTimestamp}`;
  };
  const buildVersionLabel = formatBuildVersion(buildVersion);
  const buildIndicatorClass = buildVariant === 'blue'
    ? 'bg-blue-400'
    : buildVariant === 'green'
      ? 'bg-emerald-400'
      : 'bg-slate-400';
  const buildIndicatorLabel = buildVariant;

  const copyShareLinkToClipboard = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setShowClipboardNotification(true);
      setTimeout(() => setShowClipboardNotification(false), 6000);
      console.log('✅ Share link copied to clipboard automatically');
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const pickMessage = (messages: string[]) => messages[Math.floor(Math.random() * messages.length)];

  const showHumanToast = () => {
    if (humanToastTimeout.current !== null) {
      window.clearTimeout(humanToastTimeout.current);
    }
    setHumanToastMessage(pickMessage(humanMessages));
    humanToastTimeout.current = window.setTimeout(() => {
      setHumanToastMessage(null);
      humanToastTimeout.current = null;
    }, 9000);
  };

  const matchesResumeSessionFile = (session: ResumeSession, file: File) => {
    const lastModifiedMatches = session.lastModified === undefined || session.lastModified === file.lastModified;
    return session.fileName === file.name && session.fileSize === file.size && lastModifiedMatches;
  };

  const matchesIncomingResume = (session: ResumeSession) => {
    if (!incomingFileInfo) return false;
    return session.fileName === incomingFileInfo.name && session.fileSize === incomingFileInfo.size;
  };

  const handleResumeSenderSession = (session: ResumeSession) => {
    setResumeCandidate(session);
    resumeFileInputRef.current?.click();
  };

  const handleResumeFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !resumeCandidate) return;
    if (!matchesResumeSessionFile(resumeCandidate, file)) {
      setTransferErrorMessage(`Selected file does not match the resumable transfer (${resumeCandidate.fileName}).`);
      event.target.value = '';
      return;
    }
    setTransferErrorMessage('');
    setSelectedFiles([file]);
    setShareLink('');
    setMode('share');
    await handleProceedWithTransfer([file]);
    event.target.value = '';
  };

  const handleClearResumeSession = async (session: ResumeSession) => {
    await clearTransfer(session.transferId);
    removeResumeSession(session.transferId);
    refreshResumeSessions();
  };

  const refreshResumeSessions = () => {
    setResumeSessions(normalizeResumeSessions(loadResumeSessionMap()));
  };

  useEffect(() => {
    refreshResumeSessions();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === RESUME_SESSION_KEY) {
        refreshResumeSessions();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const getCandidateType = async (conn: DataConnection): Promise<string | undefined> => {
    const pc = (conn as any).peerConnection as RTCPeerConnection | undefined;
    if (!pc || typeof pc.getStats !== 'function') return undefined;

    const stats = await pc.getStats();
    let localCandidateType: string | undefined;
    let remoteCandidateType: string | undefined;
    let localCandidateId: string | undefined;
    let remoteCandidateId: string | undefined;

    stats.forEach((report: any) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
        localCandidateId = report.localCandidateId;
        remoteCandidateId = report.remoteCandidateId;
      }
    });

    if (localCandidateId || remoteCandidateId) {
      stats.forEach((report: any) => {
        if (localCandidateId && report.id === localCandidateId) {
          localCandidateType = report.candidateType;
        }
        if (remoteCandidateId && report.id === remoteCandidateId) {
          remoteCandidateType = report.candidateType;
        }
      });
    }

    if (localCandidateType && remoteCandidateType) {
      return `${localCandidateType}/${remoteCandidateType}`;
    }
    return localCandidateType || remoteCandidateType;
  };

  const confirmRelayTransfer = async (conn: DataConnection, totalSize: number): Promise<boolean> => {
    const candidateType = await getCandidateType(conn);
    const isRelay = typeof candidateType === 'string' && candidateType.toLowerCase().includes('relay');
    if (!isRelay) return true;

    if (totalSize > RELAY_SIZE_LIMIT_BYTES) {
      setTransferErrorMessage(`Relay transfers are limited to ${formatFileSize(RELAY_SIZE_LIMIT_BYTES)}. Your selection is ${formatFileSize(totalSize)}. Try a direct connection or reduce size.`);
      setStatus('error');
      conn.close();
      return false;
    }

    const confirmMessage = `This connection requires a relay and is limited to ${formatFileSize(RELAY_SIZE_LIMIT_BYTES)}. Your transfer is ${formatFileSize(totalSize)}. Continue?`;
    if (!window.confirm(confirmMessage)) {
      setTransferErrorMessage('Relay transfer cancelled before starting.');
      setStatus('error');
      conn.close();
      return false;
    }

    return true;
  };

  useEffect(() => {
    initializePeer();
  }, [initializePeer]);

  useEffect(() => {
    if ((import.meta as any).env?.VITE_E2E) {
      (window as any).__peerConnected = isConnected;
      (window as any).__peerState = connectionState;
      (window as any).__peerId = peerId;
    }
  }, [isConnected, connectionState, peerId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themePreference);
    localStorage.setItem('theme', themePreference);
  }, [themePreference]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (currentHash) {
      setCurrentPage('home');
    }
  }, [currentHash]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!isThemeMenuOpen) return;
      const target = event.target as Node | null;
      if (target && themeToggleRef.current && themeToggleRef.current.contains(target)) {
        return;
      }
      setIsThemeMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isThemeMenuOpen]);

  useEffect(() => {
    const applyTheme = (preference: 'system' | 'light' | 'dark') => {
      const root = document.documentElement;
      const resolved = preference === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : preference;
      root.setAttribute('data-theme', resolved);
    };

    if (themePreference !== 'system') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);


  // Update meta tags for rich link previews
  useEffect(() => {
    if (mode === 'receive' && incomingFileInfo) {
      const title = `Download: ${incomingFileInfo.name}`;
      const expirationText = incomingFileInfo.expiresAt ? 
        formatExpirationTime(incomingFileInfo.expiresAt) :
        'Link expires in 24h';
      
      const description = `File size: ${formatFileSize(incomingFileInfo.size)} • ${senderPeerId ? 'Sender online' : 'Waiting for sender'} • ${expirationText}`;
      
      document.title = title;
      
      // Update Open Graph tags
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);
      
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', description);
      
      // Update Twitter tags
      let twitterTitle = document.querySelector('meta[property="twitter:title"]');
      if (twitterTitle) twitterTitle.setAttribute('content', title);
      
      let twitterDesc = document.querySelector('meta[property="twitter:description"]');
      if (twitterDesc) twitterDesc.setAttribute('content', description);
    }
  }, [mode, incomingFileInfo, senderPeerId]);

  useEffect(() => {
    const handleAnubisChallenge = (event: Event) => {
      const customEvent = event as CustomEvent<{ active: boolean; url?: string }>;
      setAnubisChallenge((prev) => ({
        active: customEvent.detail?.active ?? false,
        url: customEvent.detail?.url ?? prev.url
      }));
    };

    window.addEventListener('anubis-challenge', handleAnubisChallenge as EventListener);
    return () => window.removeEventListener('anubis-challenge', handleAnubisChallenge as EventListener);
  }, []);

  useEffect(() => {
    if (anubisChallenge.active) {
      if (anubisStatusTimeout.current !== null) {
        window.clearTimeout(anubisStatusTimeout.current);
        anubisStatusTimeout.current = null;
      }
      setAnubisStatusMessage(pickMessage(antiBotMessages));
      return;
    }

    if (anubisStatusMessage) {
      anubisStatusTimeout.current = window.setTimeout(() => {
        setAnubisStatusMessage(null);
        anubisStatusTimeout.current = null;
      }, 3000);
    }
  }, [anubisChallenge.active, anubisStatusMessage]);

  useEffect(() => {
    console.log('🔍 Mode detection useEffect running:', {
      hasHash: !!currentHash,
      hash: currentHash,
      hasPeer: !!peer,
      isConnected,
      connectionState,
    });
    
    // Auto-detect mode: receive if hash present, otherwise share
    if (currentHash && peer && isConnected) {
      console.log('📥 Hash detected and peer ready, fetching metadata...');
      setMode('receive');
      
      const shortKey = currentHash.substring(1);
      console.log('Short key:', shortKey);
      
      // Fetch metadata from API
      getMetadata(shortKey)
        .then((metadata) => {
          console.log('📄 Metadata received:', metadata);
          setSenderPeerId(metadata.peerId);
          setIncomingFileInfo({
            name: metadata.fileName,
            size: metadata.fileSize,
            expiresAt: metadata.expiresAt,
            fileType: metadata.fileType
          });
          setPendingReceive(true);
          setStatus('idle');
          
          // Update meta tags for rich link preview
          updateMetaTags(metadata);
        })
        .catch((error) => {
          console.error('❌ Failed to fetch metadata:', error);
          if (error.message === 'PIN_REQUIRED' || error.response?.status === 401) {
            setRequiresPin(true);
            setPinModeOverride(error.pinType || null);
            setStatus('idle');
          } else {
            setStatus('error');
          }
        });
    } else if (!currentHash) {
      console.log('No hash present, setting share mode');
      setMode('share');
      // Reset meta tags to default
      resetMetaTags();
    } else {
      console.log('Hash present but peer not ready, waiting...');
    }
  }, [currentHash, peer, isConnected]);

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handlePinVerification = async (enteredPin: string) => {
    setIsVerifyingPin(true);
    setPinError('');
    
    const shortKey = window.location.hash.substring(1);
    
    try {
      const metadata = await getMetadata(shortKey, enteredPin);
      setSenderPeerId(metadata.peerId);
      setIncomingFileInfo({ name: metadata.fileName, size: metadata.fileSize, expiresAt: metadata.expiresAt, fileType: metadata.fileType });
      setRequiresPin(false);
      setPinModeOverride(null);
      setPendingReceive(true);
    } catch (error: any) {
      console.error('❌ PIN verification failed:', error);
      setPinError(error.message || 'Invalid PIN');
      if (error.remainingAttempts !== undefined) {
        setRemainingAttempts(error.remainingAttempts);
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleProceedWithTransfer = async (overrideFiles?: File[]) => {
    const files = overrideFiles ?? selectedFiles;
    if (!files) return;
    setStatus('encrypting');
    const effectivePin = (import.meta as any).env?.VITE_E2E && e2ePinOverride !== null
      ? e2ePinOverride
      : pin;
    if (effectivePin && effectivePin.length > 128) {
      setTransferErrorMessage('Passphrase must be 128 characters or fewer.');
      setStatus('error');
      return;
    }
    const pinToSend = effectivePin && effectivePin.length > 0 ? effectivePin : undefined;
    
    try {
      // Debug: Log all files received
      console.log('Files selected:', files.length);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`File ${i}:`, {
          name: file.name,
          size: file.size,
          type: file.type,
          webkitRelativePath: file.webkitRelativePath,
          lastModified: file.lastModified
        });
      }
      
      // Check if this is a folder selection or multiple files
      const isFolderSelection = files.length > 1 || 
        (files.length === 1 && files[0].webkitRelativePath && files[0].webkitRelativePath.includes('/')) ||
        (files.length === 1 && files[0].size === 0 && files[0].name && !files[0].type);
      
      // Always use streaming ZIP for all shares
      const shouldZip = true;
      
      if (shouldZip && isFolderSelection) {
        console.log('Detected folder/multiple files');
        
        // If it's a single 0-byte file (likely a folder), we need to handle it differently
        if (files.length === 1 && files[0].size === 0) {
          console.log('Single 0-byte file detected, likely a folder selection issue');
          throw new Error(`Folder "${files[0].name}" appears to be empty or folder selection failed. Try selecting individual files or a different folder.`);
        }
        
        // Calculate total size
        let totalSize = 0;
        for (let i = 0; i < files.length; i++) {
          totalSize += files[i].size;
        }
        
        // Always use streaming ZIP for folders/multiple files when enabled
        if (true) {
          console.log('Large folder detected, using streaming ZIP...');
          
          // Get folder name from first file's path
          let folderName = 'files';
          if (files.length > 0 && files[0].webkitRelativePath) {
            const pathParts = files[0].webkitRelativePath.split('/');
            if (pathParts.length > 1) {
              folderName = pathParts[0];
            }
          }
          
          // Create ZIP stream using client-zip
          const { makeZip } = await import('client-zip');
          const filesToZip = [];
          for (let i = 0; i < files.length; i++) {
            filesToZip.push({
              name: files[i].webkitRelativePath || files[i].name,
              lastModified: files[i].lastModified,
              input: files[i]
            });
          }
          
          const zipStream = makeZip(filesToZip);
          const zipFileName = `${folderName}.zip`;
          
          console.log('Created ZIP stream for:', zipFileName, formatFileSize(totalSize));
          
          // Create short link via metadata API
          try {
            const shortKey = await createShortLink({
              peerId: peerId!,
              fileName: zipFileName,
              fileSize: totalSize,
              fileType: 'application/zip'
            }, pinToSend);
            const shareLink = `${window.location.origin}${window.location.pathname}#${shortKey}`;
            setShareLink(shareLink);
            await copyShareLinkToClipboard(shareLink);
            setStatus('waiting');
            showHumanToast();
          } catch (error) {
            console.error('Failed to create short link:', error);
            setTransferErrorMessage('Failed to create short link. Please try again.');
          }
          
          // Wait for receiver connection
          if (peer) {
            let connectionHandled = false;
            peer.on('connection', async (conn) => {
              console.log('Sender: Incoming connection from receiver:', conn.peer);
              conn.on('open', async () => {
                if (!(await confirmRelayTransfer(conn, totalSize))) {
                  return;
                }
                // Only handle the first successful connection
                if (connectionHandled) {
                  console.log('Connection already handled, closing additional connection');
                  conn.close();
                  return;
                }
                connectionHandled = true;
                
                console.log('Sender: Connection open, starting multi-stream ZIP transfer');
                setShowEncryptionIndicator(true);
                setIsEncryptedConnection(true);
                setStatus('transferring');
                try {
                  await transferFileAdaptive(conn, zipStream, zipFileName, totalSize);
                  setStatus('complete');
                } catch (error) {
                  console.error('Multi-stream ZIP transfer failed:', error);
                  setStatus('error');
                }
              });
              
              conn.on('close', () => {
                console.log('Connection closed with:', conn.peer);
              });
              
              conn.on('error', (error) => {
                console.error('Connection error with:', conn.peer, error);
                if (!connectionHandled) {
                  connectionHandled = false; // Allow retry if this connection failed
                }
              });
            });
          }
          return; // Exit early, don't use normal file transfer flow
        }
      } else if (shouldZip && files.length === 1) {
        // Single file with ZIP enabled - create streaming ZIP
        console.log('Single file with ZIP enabled, creating streaming ZIP...');
        const file = files[0];
        const { makeZip } = await import('client-zip');
        const zipStream = makeZip([{
          name: file.name,
          lastModified: file.lastModified,
          input: file
        }]);
        const zipFileName = `${file.name}.zip`;
        
        console.log('Created ZIP stream for single file:', zipFileName);
        
        // Create short link via metadata API
        try {
          const shortKey = await createShortLink({
            peerId: peerId!,
            fileName: zipFileName,
            fileSize: file.size,
            fileType: 'application/zip'
          }, pinToSend);
          const shareLink = `${window.location.origin}${window.location.pathname}#${shortKey}`;
          setShareLink(shareLink);
          await copyShareLinkToClipboard(shareLink);
          setStatus('waiting');
          showHumanToast();
        } catch (error) {
          console.error('Failed to create short link:', error);
          setTransferErrorMessage('Failed to create short link. Please try again.');
        }
        
        // Wait for receiver connection
        if (peer) {
          let connectionHandled = false;
          peer.on('connection', async (conn) => {
            console.log('Sender: Incoming connection from receiver:', conn.peer);
            conn.on('open', async () => {
              if (!(await confirmRelayTransfer(conn, file.size))) {
                return;
              }
              // Only handle the first successful connection
              if (connectionHandled) {
                console.log('Connection already handled, closing additional connection');
                conn.close();
                return;
              }
              connectionHandled = true;
              
              console.log('Sender: Connection open, starting stream transfer');
              setShowEncryptionIndicator(true);
              setIsEncryptedConnection(true);
              setStatus('transferring');
              try {
                await transferFileAdaptive(conn, zipStream, zipFileName, file.size);
                setStatus('complete');
              } catch (error) {
                console.error('Multi-stream ZIP transfer failed:', error);
                setStatus('error');
              }
            });
            
            conn.on('close', () => {
              console.log('Connection closed with:', conn.peer);
            });
            
            conn.on('error', (error) => {
              console.error('Connection error with:', conn.peer, error);
              if (!connectionHandled) {
                connectionHandled = false; // Allow retry if this connection failed
              }
            });
          });
        }
        return;
      }

      throw new Error('Unhandled transfer state: ZIP flow did not start');
    } catch (error) {
      console.error('Share failed:', error);
      setStatus('error');
    }
  };

  const handleChooseSaveLocation = async () => {
    setPendingReceive(false);
    setStatus('connecting');

    const fileType = incomingFileInfo?.fileType;
    const isMultiFile = fileType === 'multiple/files' || fileType === 'folder/files';

    if (isMultiFile && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        await handleReceive(dirHandle);
        await startFileReceive(dirHandle);
        return;
      } catch (error) {
        console.warn('⚠️ Directory picker cancelled, cannot receive multiple files');
        setStatus('error');
        return;
      }
    }

    if ('showSaveFilePicker' in window && incomingFileInfo?.name) {
      try {
        const pickerHandle = await (window as any).showSaveFilePicker({
          suggestedName: incomingFileInfo.name,
          types: [{ description: 'All Files', accept: { '*/*': [] } }]
        });
        await handleReceive(pickerHandle);
        await startFileReceive(pickerHandle);
        return;
      } catch (error) {
        console.warn('⚠️ File picker cancelled, falling back to download bridge');
      }
    }

    let preparedKey: string | null = null;
    if (!isMultiFile && incomingFileInfo?.name && typeof incomingFileInfo.size === 'number') {
      preparedKey = await prepareDownloadBridge(incomingFileInfo.name, incomingFileInfo.size);
      if (!preparedKey) {
        console.error('❌ Download bridge preflight failed, cannot continue');
        setStatus('error');
        return;
      }
      setDownloadKey(preparedKey);
    }

    await handleReceive(null);
    await startFileReceive(null, preparedKey);
  };

  useEffect(() => {
    if (!(import.meta as any).env?.VITE_E2E) return;

    (window as any).__e2e = {
      setFiles: (files: File[]) => setSelectedFiles(files),
      setPin: (value: string) => {
        setPin(value);
        setE2ePinOverride(value);
      },
      createLink: () => handleProceedWithTransfer(),
      getShareLink: () => shareLink,
      getStatus: () => status,
      getPendingReceive: () => pendingReceive,
      getIncomingFileInfo: () => incomingFileInfo,
      verifyPin: (value: string) => handlePinVerification(value),
      startDownload: () => handleChooseSaveLocation()
    };

    return () => {
      delete (window as any).__e2e;
    };
  }, [shareLink, status, pendingReceive, incomingFileInfo, handleChooseSaveLocation, handleProceedWithTransfer]);

  const handleReceive = async (handle?: any) => {
    // Use passed handle or fall back to state
    // null handle is OK - will use traditional download method
    const activeHandle = handle !== undefined ? handle : fileHandle;
    
    if (!senderPeerId) {
      console.error('❌ No sender peer ID available');
      setStatus('error');
      return;
    }
    
    // Store the handle and mark as ready, but don't start transfer yet
    setFileHandle(activeHandle);
    console.log('📁 Ready to receive file, waiting for user to start download');
  };

  const startFileReceive = async (handle?: any, downloadKeyOverride?: string | null) => {
    if (!senderPeerId) {
      console.error('❌ No sender peer ID');
      return;
    }
    
    // Use passed handle or fall back to state
    const activeHandle = handle !== undefined ? handle : fileHandle;
    const activeDownloadKey = downloadKeyOverride !== undefined ? downloadKeyOverride : downloadKey;
    
    try {
      console.log('Connecting to sender:', senderPeerId, 'with handle:', !!activeHandle);
      const conn = connectToPeer(senderPeerId);
      if (!conn) {
        console.error('Failed to create connection');
        return;
      }
      
      // Wait for connection to open before receiving
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 30000); // 30 second timeout
        
        conn.on('open', () => {
          console.log('Connection opened, ready to receive');
          setShowEncryptionIndicator(true);
          setIsEncryptedConnection(true);
          clearTimeout(timeout);
          resolve();
        });
        
        conn.on('error', (err) => {
          console.error('Connection error:', err);
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      setStatus('transferring');
      console.log('Starting file receive...');
      
      // Check if this is multiple files or folder
      const fileType = incomingFileInfo?.fileType;
      console.log('🔍 File type check:', { fileType, incomingFileInfo });
      
      if (fileType === 'multiple/files' || fileType === 'folder/files') {
        console.log('Receiving multiple files/folder without ZIP');
        
        if (!activeHandle) {
          // For traditional download, we need to handle multiple files differently
          console.log('Traditional download for multiple files not yet supported');
          setStatus('error');
          return;
        }
        
        // For File System Access API, we can create a directory
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite'
          });
          
          let fileCount = 0;
          let currentFileHandle: any = null;
          let currentWritable: any = null;
          
          conn.on('data', async (data: any) => {
            if (data.type === 'metadata') {
              // Close previous file if open
              if (currentWritable) {
                await currentWritable.close();
                currentWritable = null;
              }
              
              // Create new file in directory
              currentFileHandle = await dirHandle.getFileHandle(data.name, { create: true });
              currentWritable = await currentFileHandle.createWritable();
              fileCount++;
              
              console.log(`📁 Receiving file ${fileCount}: ${data.name}`);
              
              // Send acknowledgment
              conn.send({ type: 'file_ready', transferId: data.transferId });
            } else if (data.type === 'chunk' && currentWritable) {
              // Write chunk to current file
              await currentWritable.write(data.data);
              
              // Update progress (approximate)
              const fileCountStr = incomingFileInfo?.name?.match(/\d+/)?.[0] || '1';
              const progress = (fileCount / parseInt(fileCountStr)) * 100;
              console.log(`Progress: ${fileCount}/${fileCountStr} files (${Math.round(progress)}%)`);
            } else if (data.type === 'complete') {
              // Close last file
              if (currentWritable) {
                await currentWritable.close();
                currentWritable = null;
              }
              
              console.log(`✅ All ${fileCount} files received successfully`);
              setStatus('complete');
            }
          });
          
        } catch (error) {
          console.error('Failed to create directory for multiple files:', error);
          setStatus('error');
        }
      } else {
        // Single file
        console.log('📂 Single file path - Starting adaptive multi-stream download');
        await transferFileAdaptive(conn, null as any, undefined, undefined, {
          fileHandle: activeHandle,
          requireSave: true,
          downloadKey: activeDownloadKey
        });

        setStatus('complete');
        console.log('✅ File saved successfully');
      }
      
      setStatus('complete');
    } catch (error) {
      console.error('Receive failed:', error);
      setStatus('error');
    }
  };

  const handleResume = async (fromChunk: number) => {
    try {
      if (!senderPeerId) {
        console.error('No sender peer ID available for resume');
        setStatus('error');
        return;
      }
      
      console.log('Resuming connection to sender:', senderPeerId, 'from chunk:', fromChunk);
      
      // Don't change status - keep it as 'transferring' to maintain progress display
      const conn = connectToPeer(senderPeerId);
      if (!conn) return;
      
      conn.on('open', () => {
        console.log('Resume connection opened, requesting resume from chunk:', fromChunk);
        // Resume transfer from specific chunk without changing status
        resumeTransfer(conn, fromChunk);
      });
      
      conn.on('error', (err) => {
        console.error('Resume connection error:', err);
        setStatus('error');
      });
    } catch (error) {
      console.error('Resume failed:', error);
      setStatus('error');
    }
  };


  // Page routing
  if (currentPage === 'landing') {
    return (
      <Landing
        onStart={() => setCurrentPage('home')}
        onInfo={() => setCurrentPage('info')}
        onLegal={() => setCurrentPage('legal')}
      />
    );
  }

  if (currentPage === 'legal') {
    return <Legal onBack={() => setCurrentPage('home')} />;
  }
  
  if (currentPage === 'info') {
    return <Info onBack={() => setCurrentPage('home')} />;
  }

  return (
    <div className="min-h-screen app-shell flex flex-col">
      {anubisChallenge.active && anubisChallenge.url && (
        <iframe
          title="Anubis Challenge"
          src={anubisChallenge.url}
          className="fixed left-0 top-0 h-px w-px opacity-0 pointer-events-none"
        />
      )}
      {/* Animated background */}
      <div className="fixed inset-0 app-overlay-base" />
      <div className="fixed inset-0 app-overlay-accent animate-gradient-shift" />
      
      <div ref={themeToggleRef} className="fixed top-4 right-4 z-30">
        <div
          className={`flex h-10 items-center justify-center gap-1 overflow-hidden border border-white/10 bg-white/5 text-white/80 shadow-lg shadow-black/20 backdrop-blur transition-[width,border-radius,padding] duration-200 ease-out ${isThemeMenuOpen ? 'w-28 rounded-2xl px-2' : 'w-10 rounded-full'}`}
          onMouseEnter={() => setIsThemeMenuOpen(true)}
          onMouseLeave={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            setIsThemeMenuOpen(false);
          }}
        >
          {isThemeMenuOpen ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setThemePreference('system');
                  setIsThemeMenuOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${themePreference === 'system' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                title="System"
              >
                <Monitor size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setThemePreference('light');
                  setIsThemeMenuOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${themePreference === 'light' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                title="Light"
              >
                <Sun size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setThemePreference('dark');
                  setIsThemeMenuOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${themePreference === 'dark' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
                title="Dark"
              >
                <Moon size={16} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
              title="Theme"
            >
              {themePreference === 'dark' ? <Moon size={16} /> : themePreference === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-auto px-4 py-6 max-w-7xl flex-1">
        <input
          ref={resumeFileInputRef}
          type="file"
          className="hidden"
          onChange={handleResumeFilePicked}
        />
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Logo size="medium" />
          </div>
          <p className="text-white/80 text-base">
            Privacy-first file sharing with direct P2P and a polite relay backup.
          </p>
          <p className="text-white/60 text-sm mt-1">
            We don’t take ourselves too seriously — it’s a file sharing service, not rocket surgery.
          </p>
          
          {/* Connection Status Alerts */}
          {!isOnline && (
            <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-400 font-semibold text-center">
                🌐 Internet’s gone for a skate
              </p>
              <p className="text-red-300 text-sm text-center mt-1">
                Give your Wi‑Fi a polite nudge and try again.
              </p>
            </div>
          )}
          
          {connectionState === 'reconnecting' && isOnline && (
            <div className="mt-4 bg-yellow-500/20 border-2 border-yellow-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-400 font-semibold text-center">
                🔄 Reconnecting... one sec, bud
              </p>
              <p className="text-yellow-300 text-sm text-center mt-1">
                Tapping the wire politely.
              </p>
            </div>
          )}
          
          {connectionState === 'failed' && (
            <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-400 font-semibold text-center">
                ❌ Connection didn’t stick
              </p>
              <p className="text-red-300 text-sm text-center mt-1">
                Refresh and we’ll give it another go.
              </p>
            </div>
          )}
        </header>

        {/* Encryption Indicator */}
        <EncryptionIndicator
          isEncrypted={isEncryptedConnection}
          isVisible={showEncryptionIndicator}
        />

        {/* Main Content */}
        {requiresPin ? (
          <div className="glass-card" style={{ minHeight: '200px' }}>
            <PinVerification 
              onVerify={handlePinVerification}
              error={pinError}
              remainingAttempts={remainingAttempts}
              isVerifying={isVerifyingPin}
              modeOverride={pinModeOverride}
            />
          </div>
        ) : mode === 'share' ? (
          <div className="glass-card p-8" style={{ minHeight: '200px' }}>
            {!shareLink ? (
              <>
                {resumeSessions.some((session) => session.role === 'sender') && (
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-white font-semibold">Resume a paused send</div>
                        <div className="text-sm text-white/60">Pick up where you left off by selecting the original file.</div>
                      </div>
                      <button
                        type="button"
                        onClick={refreshResumeSessions}
                        className="text-sm text-white/60 hover:text-white"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {resumeSessions.filter((session) => session.role === 'sender').map((session) => (
                        <div key={session.transferId} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-white/90 font-medium truncate" title={session.fileName}>
                              {session.fileName}
                            </div>
                            <div className="text-xs text-white/60">
                              {formatFileSize(session.fileSize)} • {Math.round((session.completedShardIds.length / Math.max(1, session.shardCount)) * 100)}% cached
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleResumeSenderSession(session)}
                              className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm"
                            >
                              Resume
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClearResumeSession(session)}
                              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DropZone 
                  onFileSelect={handleFileSelect} 
                  isProcessing={isEncrypting || status === 'encrypting'}
                />
                {selectedFiles && (
                  <div className="flex flex-col gap-6 mt-6">
                    {/* File Details */}
                    {selectedFiles.length === 1 ? (
                      <div className="flex items-center justify-center gap-3 text-white/80">
                        <File size={20} className="text-blue-400" />
                        <div className="text-center">
                          <p className="font-medium">{selectedFiles[0].name}</p>
                          <p className="text-sm text-white/60">
                            {formatFileSize(selectedFiles[0].size)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <FileStructure files={selectedFiles} />
                    )}


                    {/* PIN Toggle */}
                    <PinToggle onPinChange={setPin} />

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => { setSelectedFiles(null); setPin(''); }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleProceedWithTransfer()}
                        className="btn-primary"
                        disabled={status === 'encrypting'}
                      >
                        {status === 'encrypting' ? (
                          <div className="flex items-center gap-2">
                            <span>Warming up the moose...</span>
                          </div>
                        ) : 'Make me a share link, eh?'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-6">
                <ShareLink shareLink={shareLink} />
                
                {status === 'waiting' && (
                  <div className="text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="inline-flex items-center gap-2 text-white/60">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span>Waiting for the other human to show up...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {status === 'transferring' && (
                  <div className="w-full">
                    {isAssistedConnection && (
                      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 text-white/80">
                        <div className="text-white/90 font-medium">Connection assist: engaged</div>
                        <div className="mt-1 text-sm text-white/70">
                          Still end‑to‑end encrypted. We can’t read your files and we never store them.
                          This mode can be a bit slower on some networks.
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-white/70 hover:text-white/90 transition-colors">
                            Speed tips (polite but effective)
                          </summary>
                          <div className="mt-2 space-y-1 text-sm text-white/70">
                            <div>Turn off VPN/proxy and retry</div>
                            <div>Try a different network (home Wi‑Fi vs hotspot)</div>
                            <div>UPnP can help direct connections (enable only if you’re comfy with it)</div>
                            <div>Make sure UDP/WebRTC isn’t blocked by your firewall/router</div>
                          </div>
                        </details>
                      </div>
                    )}
                    <EnhancedProgressBar 
                      progress={adaptiveProgress} 
                      label={`Transferring file (Adaptive Multi-Stream: ${adaptiveProgress.activeStreams} streams, ${adaptiveProgress.networkQuality})`} 
                      showETA={true}
                      showSpeed={true}
                    />
                  </div>
                )}
                
                {status === 'complete' && (
                  <div className="text-center">
                    <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white">
                      Transfer complete. No rocket science harmed.
                    </h3>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-8">
            <div>
              {resumeSessions.some((session) => session.role === 'receiver') && !pendingReceive && (
                <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-white font-semibold">Resume a paused download</div>
                  <div className="text-sm text-white/60">Open the original share link, then choose Resume when it’s ready.</div>
                  <div className="mt-3 grid gap-3">
                    {resumeSessions.filter((session) => session.role === 'receiver').map((session) => (
                      <div key={session.transferId} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-white/90 font-medium truncate" title={session.fileName}>
                            {session.fileName}
                          </div>
                          <div className="text-xs text-white/60">
                            {formatFileSize(session.fileSize)} • {Math.round((session.completedShardIds.length / Math.max(1, session.shardCount)) * 100)}% cached
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearResumeSession(session)}
                          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm"
                        >
                          Clear
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {status === 'connecting' && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/80">Calling the other human...</p>
                </div>
              )}
              
              {status === 'transferring' && (
                <div className="mt-8 max-w-5xl mx-auto">
                  {isAssistedConnection && (
                    <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 text-white/80">
                      <div className="text-white/90 font-medium">Connection assistance enabled</div>
                      <div className="mt-1 text-sm text-white/70">
                        Your transfer is still end-to-end encrypted. We cannot read your files and we never store them.
                        This mode can be slower on some networks.
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-white/70 hover:text-white/90 transition-colors">
                          Tips to improve speed
                        </summary>
                          <div className="mt-2 space-y-1 text-sm text-white/70">
                            <div>Disable VPN/proxy and retry</div>
                            <div>Try a different network (home Wi-Fi vs mobile hotspot)</div>
                            <div>On home routers, UPnP can help direct connections (only enable if you understand the risks)</div>
                            <div>Ensure UDP/WebRTC is allowed by firewall/router</div>
                          </div>
                        </details>
                    </div>
                  )}
                  <EnhancedProgressBar 
                    progress={adaptiveProgress} 
                    label={`Receiving file (Adaptive Multi-Stream: ${adaptiveProgress.activeStreams} streams, ${adaptiveProgress.networkQuality})`}
                    showETA={true}
                    showSpeed={true}
                  />
                </div>
              )}
              
              {!isTransferring && transferProgress.percentage > 0 && transferProgress.percentage < 100 && (
                <div className="text-center mt-4">
                  <p className="text-yellow-400 mb-2">Transfer took a coffee break</p>
                  {/* <ResumeButton
                    onClick={() => {
                      const resumeFromChunk = Math.floor(transferProgress.bytesTransferred / (64 * 1024));
                      handleResume(resumeFromChunk);
                    }}
                    disabled={false}
                    progress={transferProgress.percentage}
                  /> */}
                </div>
              )}
              
              {status === 'complete' && (
                <div className="text-center mt-8">
                  <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white">
                    File downloaded successfully!
                  </h3>
                </div>
              )}
              
              {pendingReceive && incomingFileInfo && (
                <div className="text-center py-12">
                  <Download size={64} className="text-blue-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Ready to receive file
                  </h3>
                  
                  <div className="bg-white/5 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate" title={incomingFileInfo.name}>
                          {incomingFileInfo.name}
                        </p>
                        <p className="text-white/60 text-sm mt-1">
                          {(incomingFileInfo.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        {incomingFileInfo.expiresAt && (
                          <p className="text-white/60 text-sm mt-1">
                            {formatExpirationTime(incomingFileInfo.expiresAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-w-md mx-auto mb-6">
                    <FileTypeWarning fileName={incomingFileInfo.name} />
                  </div>

                  {resumeSessions.some((session) => session.role === 'receiver' && matchesIncomingResume(session)) && (
                    <div className="max-w-md mx-auto mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                      <div className="text-white/90 font-medium">Resume detected</div>
                      <div className="text-sm text-white/60 mt-1">
                        We found cached shards for this file. Resume to skip the verified parts.
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={handleChooseSaveLocation}
                          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm"
                        >
                          Resume download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const match = resumeSessions.find((session) => session.role === 'receiver' && matchesIncomingResume(session));
                            if (match) {
                              void handleClearResumeSession(match);
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm"
                        >
                          Start fresh
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleChooseSaveLocation}
                    className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors shadow-lg"
                  >
                    Start the download, eh?
                  </button>
                  <p className="text-white/60 mt-4 text-sm">
                    Pick a save spot when your browser asks nicely.
                  </p>
                </div>
              )}
              
              {status === 'idle' && !pendingReceive && !currentHash && (
                <div>
                  <Download size={64} className="text-white/40 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Waiting for a share link...
                  </h3>
                  <p className="text-white/60">
                    Open one and we’ll get you the goods.
                  </p>
                </div>
              )}
              {status === 'error' && (
                <div>
                  <div className="text-6xl mb-4">❌</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Transfer bailed
                  </h3>
                  <p className="text-white/80">
                    {transferErrorMessage || 'We hit a snag. Give it another go.'}
                  </p>
                  {transferProgress.percentage > 0 && transferProgress.percentage < 100 && (
                    <div className="flex justify-center mt-4">
                      <button 
                        onClick={() => handleResume(0)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Resume the transfer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="glass-card p-6 text-center">
            <Shield className="text-blue-400 mx-auto mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">Direct P2P, no detours</h3>
            <p className="text-white/60 text-sm">
              Browser-to-browser transfer, with a relay only when needed.
            </p>
          </div>
          
          <div className="glass-card p-6 text-center">
            <Shield className="text-purple-400 mx-auto mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">End-to-end encrypted</h3>
            <p className="text-white/60 text-sm">
              Your files get encrypted in your browser before they go anywhere.
            </p>
          </div>
          
          <div className="glass-card p-6 text-center">
            <Share2 className="text-pink-400 mx-auto mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">Simple sharing</h3>
            <p className="text-white/60 text-sm">
              Share a link. No signup, no drama.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <div className="glass-card p-6">
            <button
              type="button"
              onClick={() => setIsFaqExpanded((prev) => !prev)}
              className="group mx-auto mb-3 flex items-center gap-2 text-center text-xl font-semibold text-white"
              aria-expanded={isFaqExpanded}
            >
              <span>FAQ</span>
              <ChevronDown
                size={16}
                className={`text-white/60 transition-transform ${isFaqExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`space-y-4 overflow-hidden text-sm text-white/70 text-left transition-[max-height] duration-300 ease-out ${
                isFaqExpanded ? 'max-h-[760px]' : 'max-h-0'
              }`}
            >
              <div>
                <h3 className="text-white font-semibold">Is this actually peer-to-peer?</h3>
                <p>Yep. Files go browser-to-browser via WebRTC DataChannels. If a direct path fails, a TURN relay may carry encrypted data.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">How do you protect my privacy?</h3>
                <p>Files are encrypted in your browser with AES-GCM. Signaling/metadata services coordinate connections and never see file contents. Links expire after 24 hours (optional PIN).</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">How do you avoid corrupted transfers?</h3>
                <p>WebRTC uses reliable, ordered DataChannels plus AES-GCM authentication. If integrity checks fail, the transfer stops so you can retry.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">Do session IDs stick around?</h3>
                <p>Nope. Each page load gets a fresh PeerJS ID that only exists for this session.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">Do I need an account?</h3>
                <p>No account required. Make a link and send it.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">How long do links last?</h3>
                <p>Links expire after 24 hours to keep things tidy.</p>
              </div>
              <div>
                <h3 className="text-white font-semibold">Will it work on restricted networks?</h3>
                <p>Some work/school networks block WebRTC or force relays. If it’s grumpy, try another network.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/10">
        <div className="mx-auto w-full max-w-none px-[15px] py-1">
          <div className="grid gap-0.5">
            <div className="flex flex-wrap items-center justify-center gap-x-[clamp(6px,1.8vw,14px)] gap-y-1 text-center text-[clamp(10px,2.2vw,14px)] text-white/60 max-[640px]:w-full max-[640px]:flex-nowrap max-[640px]:justify-between max-[640px]:gap-x-0 max-[640px]:text-[9px]">
              <a
                href="https://buymeacoffee.com/p2p.red"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center whitespace-nowrap leading-none text-yellow-400 transition-colors hover:text-yellow-300"
              >
                Support
              </a>
              <button
                onClick={() => setCurrentPage('info')}
                className="inline-flex items-center whitespace-nowrap leading-none text-white/60 transition-colors hover:text-white"
              >
                Info
              </button>
              <button
                onClick={() => setCurrentPage('legal')}
                className="inline-flex items-center whitespace-nowrap leading-none text-white/60 transition-colors hover:text-white"
              >
                Legal
              </button>
              <span className="inline-flex items-center whitespace-nowrap leading-none text-white/60">© 2026 p2p.red</span>
              <a
                href="https://cv.tee215.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 whitespace-nowrap leading-none text-white/50"
              >
                <span className="whitespace-nowrap">Logo by</span>
                <span className="text-blue-400 transition-colors group-hover:text-blue-300">Talal Al-Saymaree</span>
              </a>
              <span className="group relative inline-flex items-center whitespace-nowrap leading-none text-white/60">
                <span className="text-base" role="img" aria-label="Canada">🇨🇦</span>
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Proudly made in Canada from Canadian grown ingredients
                </span>
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end">
                {buildIndicatorClass && buildIndicatorLabel && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 shadow-lg shadow-black/20 backdrop-blur">
                    <div className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${buildIndicatorClass} shadow-[0_0_8px_rgba(255,255,255,0.35)]`} />
                      <span>{buildIndicatorLabel}</span>
                    </div>
                    {buildVersionLabel && (
                      <div className="mt-1 text-[9px] font-normal uppercase tracking-[0.2em] text-white/50">
                        {buildVersionLabel}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-end">
                <Monitoring placement="footer" />
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie/Privacy Banner */}
      <CookieBanner />
      
      {/* Monitoring */}

      {/* Clipboard Notification */}
      {showClipboardNotification && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out z-50">
          <div className="flex items-center gap-3">
            <Check size={20} />
            <span className="font-medium">Link copied. You’re basically a wizard.</span>
          </div>
        </div>
      )}
      {humanToastMessage && (
        <div className="fixed bottom-24 right-8 bg-white/10 text-white/90 px-5 py-3 rounded-lg shadow-lg backdrop-blur border border-white/10 transform transition-all duration-300 ease-in-out z-50 max-w-xs">
          <div className="text-sm font-medium">{humanToastMessage}</div>
        </div>
      )}
      {anubisStatusMessage && (
        <div className="fixed bottom-24 left-8 bg-white/5 text-white/70 px-4 py-2 rounded-full shadow-lg backdrop-blur border border-white/10 transform transition-all duration-300 ease-in-out z-50">
          <div className="text-xs font-medium">{anubisStatusMessage}</div>
        </div>
      )}
      
    </div>
  );
}

export default App;
