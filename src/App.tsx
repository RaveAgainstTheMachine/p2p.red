import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { FileStructure } from './components/FileStructure';
import { Logo } from './components/Logo';
import { GlowBackground } from './components/GlowBackground';
import { AppFooter } from './components/AppFooter';
import { PinVerification } from './components/PinVerification';
import { PinToggle } from './components/PinToggle';
import { ShareLink } from './components/ShareLink';
import { Download, File, Check, Sun, Moon, Palette, Shuffle, CloudSun, ArrowLeft } from 'lucide-react';
import { createShortLink, getMetadata, API_BASE_URL } from './services/metadataApi';
import { formatExpirationTime } from './utils/timeFormat';
import { Info } from './pages/Info';
import { Legal } from './pages/Legal';
import { Landing } from './pages/Landing';
import { Changelog } from './pages/Changelog';
import { Feedback } from './pages/Feedback';
import { clearTransfer } from './utils/shardStore';

const getCookie = (name: string) => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const setCookie = (name: string, value: string, days = 365) => {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
};

const THEMES = [
  { id: 'random', name: 'Random', colors: ['#ffffff', '#000000'] },
  { id: 'indigo', name: 'Indigo (Ocean)', colors: ['#6366f1', '#a855f7'] },
  { id: 'emerald', name: 'Emerald (Forest)', colors: ['#10b981', '#0d9488'] },
  { id: 'rose', name: 'Rose (Sunset)', colors: ['#f43f5e', '#e11d48'] },
  { id: 'amber', name: 'Amber (Sahara)', colors: ['#f59e0b', '#d97706'] },
  { id: 'cyan', name: 'Cyan (Atmosphere)', colors: ['#06b6d4', '#0891b2'] },
  { id: 'slate', name: 'Slate (Monolith)', colors: ['#64748b', '#475569'] },
  { id: 'crimson', name: 'Crimson (Magma)', colors: ['#dc2626', '#991b1b'] },
  { id: 'violet', name: 'Violet (Nebula)', colors: ['#8b5cf6', '#7c3aed'] },
  { id: 'lime', name: 'Lime (Electric)', colors: ['#84cc16', '#65a30d'] },
  { id: 'ebony', name: 'Ebony (Void)', colors: ['#1e293b', '#0f172a'] },
] as const;

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
  updateMetaTag('og:site_name', 'P2P File Share');
  
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
  updateMetaTag('og:url', `${window.location.origin}/`);
  updateMetaTag('og:title', 'P2P File Share - Secure File Sharing');
  updateMetaTag('og:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  updateMetaTag('og:site_name', 'P2P File Share');
  
  // Reset Twitter Card tags
  updateMetaName('twitter:card', 'summary');
  updateMetaName('twitter:url', `${window.location.origin}/`);
  updateMetaName('twitter:title', 'P2P File Share - Secure File Sharing');
  updateMetaName('twitter:description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage.');
  
  // Reset basic meta description
  updateMetaName('description', 'Share files securely with end-to-end encryption. Direct P2P with relay fallback. No server file storage, no tracking.');
};

// Recursive dir reader for global dropzone
const readDirEntry = async (entry: any, prefix = ''): Promise<File[]> => {
  const files: File[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<any[]> =>
    new Promise((res, rej) => reader.readEntries(res, rej));

  let batch: any[];
  do {
    batch = await readBatch();
    for (const child of batch) {
      if (child.isFile) {
        const file: File = await new Promise((res, rej) => child.file(res, rej));
        try {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: prefix + file.name,
            writable: false,
            configurable: true,
          });
        } catch { /* already set */ }
        files.push(file);
      } else if (child.isDirectory) {
        files.push(...await readDirEntry(child, prefix + child.name + '/'));
      }
    }
  } while (batch.length > 0);

  return files;
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
  const pageTransition = {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { opacity: 0, x: '-10%', transition: { duration: 0.3 } },
    transition: { 
      type: 'spring',
      stiffness: 150,
      damping: 25,
      mass: 1
    }
  };

  const { peer, peerId, isConnected, connectionState, isOnline, connectToPeer } = useWebRTC();
  const { isEncrypting } = useEncryption();
  const { transferProgress, resumeTransfer } = useFileTransfer();
  const { transferProgress: adaptiveProgress, transferFileAdaptive, prepareDownloadBridge } = useAdaptiveMultiStreamTransfer();

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

  // Global DropZone logic
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const globalDragCounter = useRef(0);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    globalDragCounter.current += 1;
    if (!(isEncrypting || status === 'encrypting' || isProcessingFiles)) {
      setGlobalDragActive(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    globalDragCounter.current = Math.max(0, globalDragCounter.current - 1);
    if (globalDragCounter.current === 0) {
      setGlobalDragActive(false);
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalDragCounter.current = 0;
    setGlobalDragActive(false);
    
    // Immediate navigation for better UX
    setCurrentPage('home');
    
    if (isEncrypting || status === 'encrypting' || isProcessingFiles) return;

    const { items } = e.dataTransfer;
    if (!items || items.length === 0) return;

    // Set internal processing if we suspect this might take a moment
    if (items.length > 5 || Array.from(items).some(item => (item as any).webkitGetAsEntry?.()?.isDirectory)) {
      setIsProcessingFiles(true);
    }

    try {
      const collected: Array<{ entry: any; fallbackFile: File | null }> = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const entry = (item as any).webkitGetAsEntry?.();
        collected.push({ entry: entry ?? null, fallbackFile: entry ? null : item.getAsFile() });
      }

      const allFiles: File[] = [];
      for (const { entry, fallbackFile } of collected) {
        if (entry?.isDirectory) {
          allFiles.push(...await readDirEntry(entry, entry.name + '/'));
        } else if (entry?.isFile) {
          const file: File = await new Promise((res, rej) => entry.file(res, rej));
          allFiles.push(file);
        } else if (fallbackFile) {
          allFiles.push(fallbackFile);
        }
      }

      if (allFiles.length > 0) handleFileSelect(allFiles);
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleGlobalClick = (e: React.MouseEvent) => {
    console.log('🖱️ Global click target:', (e.target as HTMLElement).tagName, (e.target as HTMLElement).className);
    if (isEncrypting || status === 'encrypting' || isProcessingFiles) return;
    // Don't trigger file picker if clicking interactive elements
    const interactive = (e.target as HTMLElement).closest('.glass-card, button, a, input, select, nav, footer, .theme-picker-menu, [role="button"]');
    if (interactive) {
      console.log('🚫 Click on interactive element, skipping picker');
      return;
    }
    
    console.log('📂 Triggering global file picker');
    // If not clicking a card/button/link, it's a background click
    globalFileInputRef.current?.click();
  };

  const handleGlobalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList);
      console.log('📂 Global input change detected:', files.length, 'files');
      setCurrentPage('home');
      if (files.length > 50) setIsProcessingFiles(true);
      setTimeout(() => {
        handleFileSelect(files);
        setIsProcessingFiles(false);
      }, 10);
    }
    e.target.value = '';
  };

  // Sender: Handle preview connections
  useEffect(() => {
    if (!peer || status !== 'waiting' || !selectedFiles || selectedFiles.length === 0) return;
    
    const handleConnection = (conn: any) => {
      if (conn.metadata?.type === 'preview') {
        console.log('Sender: Incoming preview connection from', conn.peer);
        conn.on('open', () => {
          conn.send({
            type: 'FILE_LIST',
            files: selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
          });
          setTimeout(() => conn.close(), 2000);
        });
      }
    };
    
    peer.on('connection', handleConnection);
    return () => {
      peer.off('connection', handleConnection);
    };
  }, [peer, status, selectedFiles]);

  const [pinError, setPinError] = useState<string>('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>(undefined);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'landing' | 'home' | 'legal' | 'info' | 'changelog' | 'feedback'>('home');
  const [themePreference, setThemePreference] = useState<'brighter-dark' | 'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'brighter-dark') {
      return storedTheme;
    }
    return 'brighter-dark';
  });
  const [variantPreference, setVariantPreference] = useState<string>(() => {
    return getCookie('p2p_variant') || 'random';
  });
  const [activeVariant, setActiveVariant] = useState<string>('indigo');

  useEffect(() => {
    if (variantPreference === 'random') {
      const realThemes = THEMES.filter(t => t.id !== 'random');
      const randomTheme = realThemes[Math.floor(Math.random() * realThemes.length)].id;
      setActiveVariant(randomTheme);
    } else {
      setActiveVariant(variantPreference);
    }
  }, [variantPreference]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-variant', activeVariant);
  }, [activeVariant]);

  const [currentHash, setCurrentHash] = useState<string>(window.location.hash);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeToggleRef = useRef<HTMLDivElement | null>(null);
  const [showClipboardNotification, setShowClipboardNotification] = useState<boolean>(false);
  const [anubisStatusMessage, setAnubisStatusMessage] = useState<string | null>(null);
  const [mooseMessage, setMooseMessage] = useState<string | null>(null);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string>('');

  const [anubisChallenge, setAnubisChallenge] = useState<{ active: boolean; url?: string }>({
    active: false
  });
  const anubisStatusTimeout = useRef<number | null>(null);
  const antiBotMessages = [
    'Quick bot check — please hold, carbon-based lifeform.',
    'Verifying you’re human. Sorry, robots ruined it for everyone.',
    'Anti-bot scan running. If you’re a toaster, now’s the time to confess.',
    'Confirming you’re not a swarm of polite Canadian geese.',
    'Bot-detector warming up. Please sip maple syrup and wait.',
    'Asking the security moose for clearance...',
    'Tuning the moose-dar to detect silicon brain waves...',
    'Distracting the bots with virtual pizza...',
    'Convincing the cloud that you are indeed a real person...',
    'Checking if you have a favorite hockey team (classic human test)...'
  ];
  const humanMessages = [
    'Well done being a human! Share link ready.',
    'Certified organic human ✅ Your link is ready.',
    'Humans 1, bots 0. Share link created.',
    'Thanks for proving you’re not a Roomba. Link generated.',
    'You passed the Turing Share link ready.',
    'Moose approved! Your secure link is ready to go.',
    'The bots are crying oil. You win! Link ready.',
    'Human detected! Access granted. Grab your link below.',
    'No robot detected. You’re the boss. Link ready.',
    'Security moose bows to you. Link created!'
  ];
  const MOOSE_MESSAGES = [
    "No intruders today I've checked the perimeter and it's looking real good.",
    "Your connection is as solid as a frozen pond in February. All clear!",
    "Encrypted? You betcha! I don't settle for less than maple-syrup-thick security.",
    "Relax. I'm watching the packets like a goalie in the third period. All clear!",
    "A moose never sleeps on the job, sorry. Your data is safe and sound",
    "Looking for leaks? Not on my watch, oop—just scooting past any potential trouble.",
    "I've sniffed the peer connection. It's cleaner than a fresh sheet of ice.",
    "Safe and sound. Like a moose with a double-double. Everything's lookin' great",
  ];

  const buildVariantRaw = (import.meta as any)?.env?.VITE_BUILD_VARIANT?.toLowerCase?.();
  const buildVariant = buildVariantRaw || 'dev';
  const buildVersion = (import.meta as any)?.env?.VITE_BUILD_VERSION;
  const buildIndicatorClass = buildVariant === 'blue'
    ? 'bg-blue-400'
    : buildVariant === 'green'
      ? 'bg-emerald-400'
      : 'bg-slate-400';
  const buildIndicatorLabel = buildVariant;
  const commitId = buildVersion ? buildVersion.split('-')[1] : '';
  const shortVersion = buildVersion ? buildVersion.split('-')[0] : '1.5.0';
  const displayVersion = commitId ? `${shortVersion}-${commitId}` : shortVersion;

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
    if (anubisStatusTimeout.current !== null) {
      window.clearTimeout(anubisStatusTimeout.current);
    }
    setAnubisStatusMessage(pickMessage(humanMessages));
    anubisStatusTimeout.current = window.setTimeout(() => {
      setAnubisStatusMessage(null);
      anubisStatusTimeout.current = null;
    }, 6000);
  };

  const handleMooseClick = () => {
    const randomMessage = MOOSE_MESSAGES[Math.floor(Math.random() * MOOSE_MESSAGES.length)];
    setMooseMessage(randomMessage);
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
      // Signal the receiver about the relay limit so both sides see the warning
      try { conn.send({ type: 'relay_limit_warning', totalSize }); } catch {}
      setRelayLimitWarning({ totalSize, isRelay: true });
      conn.close();
      return false;
    }

    // Relay ≤100GB — proceed silently, no popup
    return true;
  };



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
    const applyTheme = (preference: 'brighter-dark' | 'light' | 'dark') => {
      const root = document.documentElement;
      root.setAttribute('data-theme', preference);
    };

    applyTheme(themePreference);
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
      }, 5000); // Show for 5 seconds
    }
  }, [anubisChallenge.active]);

  useEffect(() => {
    if (!currentHash) {
      if (mode !== 'share') {
        console.log('No hash present, setting share mode');
        setMode('share');
        resetMetaTags();
      }
      return;
    }

    if (peer && isConnected) {
      if (mode !== 'receive') {
        console.log('Hash present and peer ready, setting receive mode');
        setMode('receive');
        
        const shortKey = currentHash.substring(1);
        getMetadata(shortKey)
          .then((metadata) => {
            setSenderPeerId(metadata.peerId);
            setIncomingFileInfo({
              name: metadata.fileName,
              size: metadata.fileSize,
              expiresAt: metadata.expiresAt,
              fileType: metadata.fileType
            });
            setPendingReceive(true);
            setStatus('idle');
            updateMetaTags(metadata);
          })
          .catch((error) => {
            console.error('❌ Failed to fetch metadata:', error);
            if (error.message === 'PIN_REQUIRED') {
              setRequiresPin(true);
              setPinModeOverride(error.pinType || null);
              setStatus('idle');
            } else {
              setStatus('error');
            }
          });
      }
    }
  }, [currentHash, peer, isConnected, mode]);

  // Receiver: Fetch preview when metadata is ready
  useEffect(() => {
    if (pendingReceive && senderPeerId && peer && isConnected && !incomingFilesList) {
      console.log('Fetching file list preview...');
      try {
        const previewConn = peer.connect(senderPeerId, { metadata: { type: 'preview' } });
        
        previewConn.on('data', (data: any) => {
          if (data?.type === 'FILE_LIST') {
            console.log('Received file list preview:', data.files);
            setIncomingFilesList(data.files);
            previewConn.close();
          }
        });
        
        previewConn.on('error', () => previewConn.close());
        setTimeout(() => previewConn.close(), 10000);
      } catch (err) {
        console.error('Preview connection failed:', err);
      }
    }
  }, [pendingReceive, senderPeerId, peer, isConnected, incomingFilesList]);

  const handleFileSelect = (files: File[]) => {
    console.log('🎯 handleFileSelect called with:', files.length, 'files');
    if (!files || files.length === 0) return;
    
    // Always navigate to home when files are selected/dropped
    setCurrentPage('home');
    
    if (files.length > 50) {
      setIsProcessingFiles(true);
      // Brief delay to allow UI to show processing state before heavy setSelectedFiles call
      setTimeout(() => {
        setSelectedFiles(files);
        setIsProcessingFiles(false);
      }, 100);
    } else {
      setSelectedFiles(files);
    }
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
    if (!files || files.length === 0) {
      console.warn('Attempted to proceed with 0 files');
      return;
    }
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
            console.log('✅ Share link set and copied to clipboard');
          } catch (error) {
            console.error('❌ Failed to create short link (in catch):', error);
            setTransferErrorMessage(`Failed to create short link: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setStatus('error');
          }
          
          // Wait for receiver connection
          if (peer) {
            let connectionHandled = false;
            peer.on('connection', async (conn) => {
              if (conn.metadata?.type === 'preview') return;
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
          setStatus('error');
        }
        
        // Wait for receiver connection
        if (peer) {
          let connectionHandled = false;
          peer.on('connection', async (conn) => {
            if (conn.metadata?.type === 'preview') return;
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
              if (data.type === 'relay_limit_warning') {
                setRelayLimitWarning({ totalSize: data.totalSize, isRelay: true });
              }
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


  /* Unified Shell Content */
  const renderPageContent = () => {
    switch (currentPage) {
      case 'landing':
        return (
          <Landing
            onStart={() => setCurrentPage('home')}
            onInfo={() => setCurrentPage('info')}
          />
        );
      case 'legal':
        return <Legal onBack={() => setCurrentPage('home')} />;
      case 'info':
        return <Info onBack={() => setCurrentPage('home')} />;
      case 'changelog':
        return <Changelog onBack={() => setCurrentPage('home')} />;
      case 'feedback':
        return <Feedback onBack={() => setCurrentPage('home')} apiBaseUrl={API_BASE_URL} />;
      case 'home':
      default:
        return (
          <>
            {requiresPin ? (
              <div className="glass-card w-full max-w-2xl mx-auto" style={{ minHeight: '200px' }}>
                <PinVerification 
                  onVerify={handlePinVerification}
                  error={pinError}
                  remainingAttempts={remainingAttempts}
                  isVerifying={isVerifyingPin}
                  modeOverride={pinModeOverride}
                />
              </div>
            ) : mode === 'share' ? (
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
                        <EnhancedProgressBar progress={adaptiveProgress} label="Transferring..." showETA showSpeed />
                      )}
                      {status === 'complete' && (
                        <div className="text-center text-green-400 font-semibold">Transfer complete!</div>
                      )}
                      {status === 'error' && (
                        <div className="text-center text-red-400">
                          <p>Transfer failed</p>
                          <p className="text-sm text-red-400/70">{transferErrorMessage}</p>
                          {transferProgress.percentage > 0 && transferProgress.percentage < 100 && (
                            <button onClick={() => handleResume(0)} className="mt-4 px-4 py-2 bg-blue-600 rounded text-white text-sm">Resume</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
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
                    <EnhancedProgressBar progress={adaptiveProgress} label="Receiving..." showETA showSpeed />
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
            )}
          </>
        );
    }
  };

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden bg-[var(--theme-bg-1)] relative text-white font-inter selection:bg-[var(--theme-primary)]/30"
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      <GlowBackground />
      
      <input
        ref={globalFileInputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleGlobalInputChange}
      />

      {anubisChallenge.active && anubisChallenge.url && (
        <iframe
          title="Anubis Challenge"
          src={anubisChallenge.url}
          className="fixed left-[-1000px] top-[-1000px] h-20 w-20 opacity-1 z-50"
        />
      )}
      
      <div ref={themeToggleRef} className="fixed top-4 right-4 z-40">
        <div
          className="flex flex-col items-end gap-2"
          onMouseEnter={() => setIsThemeMenuOpen(true)}
          onMouseLeave={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            setIsThemeMenuOpen(false);
          }}
        >
          <button
            type="button"
            className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-200 hover:text-white hover:scale-110 active:scale-95 ${isThemeMenuOpen ? 'border-white/30 bg-white/15' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsThemeMenuOpen(!isThemeMenuOpen);
            }}
          >
            <Palette size={20} className={`text-[var(--theme-primary)] ${isThemeMenuOpen ? 'rotate-12 scale-110' : ''}`} />
          </button>

          {isThemeMenuOpen && (
            <div className="theme-picker-menu flex w-48 flex-col gap-4 rounded-3xl border border-white/15 bg-black/40 p-4 shadow-2xl backdrop-blur-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-2">
                <span className="theme-picker-label text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Brightness</span>
                <div className="flex gap-1 justify-between bg-white/5 rounded-2xl p-1">
                  {[
                    { id: 'light', icon: Sun, label: 'Light' },
                    { id: 'brighter-dark', icon: CloudSun, label: 'Brighter Dark' },
                    { id: 'dark', icon: Moon, label: 'Dark' },
                  ].map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setThemePreference(id as any)}
                      className={`flex h-7 flex-1 items-center justify-center rounded-lg transition-all border border-transparent ${themePreference === id ? 'bg-white/20 text-white border-white/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                      title={label}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="theme-picker-label text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">Color Palette</span>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setVariantPreference(theme.id);
                        setCookie('p2p_variant', theme.id);
                      }}
                      className={`group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${variantPreference === theme.id ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-black/50' : 'hover:scale-110'}`}
                      title={theme.name}
                    >
                      {theme.id === 'random' ? (
                        <div className="theme-picker-random flex h-full w-full items-center justify-center rounded-lg bg-white/10 text-white/70 group-hover:text-white">
                          <Shuffle size={14} />
                        </div>
                      ) : (
                        <div 
                          className="h-full w-full rounded-lg border border-white/10"
                          style={{ 
                            background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` 
                          }}
                        />
                      )}
                      {variantPreference === theme.id && (
                        <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-black shadow-sm">
                          <Check size={8} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Main App Container - Stationary Layout */}
      <div className="flex flex-col flex-1 min-h-0 relative z-10">

        <input
          ref={resumeFileInputRef}
          type="file"
          className="hidden"
          onChange={handleResumeFilePicked}
        />

        {/* Connection status banners - Stationary below nav */}
        {(!isOnline || connectionState === 'failed') && (
          <div className="mx-auto w-full max-w-2xl px-4 py-2 z-50 relative">
            {!isOnline && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-center">
                No internet — give your Wi-Fi a nudge.
              </div>
            )}
            {connectionState === 'failed' && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-center">
                Connection failed — refresh to retry.
              </div>
            )}
          </div>
        )}

        {/* Encryption Indicator */}
        <EncryptionIndicator
          isEncrypted={isEncryptedConnection}
          isVisible={showEncryptionIndicator}
        />

        {/* Header with Logo and Headlines */}
        <header className="w-full px-4 sm:px-6 pt-4 sm:pt-5 pb-2 relative z-50">
          <div className="flex flex-col items-center sm:block relative">
             {/* Logo - top left on desktop, centered above on mobile */}
             <a
              href="https://P2P File Share"
              className="opacity-80 hover:opacity-100 transition-opacity shrink-0 sm:absolute sm:left-0 sm:top-0 sm:mt-1"
              title="P2P File Share"
            >
              <Logo size="small" />
            </a>

            {/* Headlines - centered, stacks below logo on mobile */}
            <div className="w-full flex flex-col items-center pointer-events-none select-none mt-2 sm:mt-0">
              <p className="header-headline text-[clamp(18px,4.5vw,36px)] font-bold uppercase text-center">
                Send files securely and privately
              </p>
              <p className="text-[clamp(8px,1.8vw,11px)] font-bold uppercase tracking-[0.45em] text-[var(--theme-primary)] opacity-70 mt-2 sm:mt-3 text-center">
                No account or login required
              </p>
            </div>
          </div>
        </header>

        {/* Hero — centered, WeTransfer-style */}
        <main 
          className="flex-1 relative overflow-hidden"
          onClick={handleGlobalClick}
        >
          <DropZone
            dragActive={globalDragActive}
            isProcessing={isEncrypting || status === 'encrypting' || isProcessingFiles}
            showUI={currentPage === 'home' && mode === 'share' && !shareLink && !selectedFiles}
          />

          <AnimatePresence initial={false}>
            <motion.div
              key={currentPage}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageTransition}
              className="w-full h-full overflow-y-auto overflow-x-hidden absolute inset-0 px-4 py-6 will-change-transform"
            >
              <div className="w-full min-h-full flex flex-col items-center justify-center py-12">
                <div className="w-full max-w-6xl flex flex-col items-center">
                  {renderPageContent()}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer - Inside h-screen to stay at bottom without causing outer scroll */}
        <AppFooter 
          onNavigate={setCurrentPage}
          displayVersion={displayVersion}
          buildIndicatorClass={buildIndicatorClass}
          buildIndicatorLabel={buildIndicatorLabel}
          themePreference={themePreference}
          variantPreference={variantPreference}
          onSetTheme={(t: string) => setThemePreference(t as any)}
          onSetVariant={(v) => {
            setVariantPreference(v);
            setCookie('p2p_variant', v);
          }}
          onMooseClick={handleMooseClick}
        />
      </div>

      {/* Cookie/Privacy Banner - Global Fixed */}
      <CookieBanner />
      
      {/* Clipboard Notification - Global Fixed */}
      {showClipboardNotification && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out z-50">
          <div className="flex items-center gap-3">
            <Check size={20} />
            <span className="font-medium">Link copied! You're basically a wizard</span>
          </div>
        </div>
      )}

      {/* Mobile Back Arrow — only on subpages */}
      {currentPage !== 'home' && currentPage !== 'landing' && (
        <button
          onClick={() => setCurrentPage('home')}
          className="sm:hidden fixed bottom-24 right-6 z-[110] flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--theme-primary)] text-white shadow-lg shadow-black/40 animate-fade-up border border-white/20"
          aria-label="Back to home"
        >
          <ArrowLeft size={24} />
        </button>
      )}

      {/* Security Moose Overlay */}
      {mooseMessage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-6"
          onClick={() => setMooseMessage(null)}
        >
          <div 
            className="flex flex-col items-center gap-6 max-w-sm text-center animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <img src="/assets/security-moose.png" alt="Security Moose" className="w-48 h-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
              <p className="text-white text-lg font-medium leading-relaxed italic">"{mooseMessage}"</p>
              <button 
                onClick={() => setMooseMessage(null)}
                className="mt-6 w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
