import type { TransferMessage, RTCStatsReportExt } from './types/transfer';
import { debugLog, debugWarn, debugError } from './utils/logger';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DataConnection } from 'peerjs';
import { useWebRTC } from './hooks/useWebRTC';
import { siteName, siteDomain } from './config/environments';
import { useAdaptiveMultiStreamTransfer } from './hooks/useAdaptiveMultiStreamTransfer';
import { useAppState } from './hooks/useAppState';
import { DropZone } from './components/DropZone';
import { EncryptionIndicator } from './components/EncryptionIndicator';
import { CookieBanner } from './components/CookieBanner';
import { Logo } from './components/Logo';
import { GlowBackground } from './components/GlowBackground';
import { AppFooter } from './components/AppFooter';
import { PinVerification } from './components/PinVerification';
import { SharePage } from './components/SharePage';
import { ReceivePage } from './components/ReceivePage';
import { Check, Sun, Moon, Palette, Shuffle, CloudSun, ArrowLeft } from 'lucide-react';
import { createShortLink, getMetadata, API_BASE_URL } from './services/metadataApi';
import { formatExpirationTime } from './utils/timeFormat';
import { Info } from './pages/Info';
import { Legal } from './pages/Legal';
import { Landing } from './pages/Landing';
import { Feedback } from './pages/Feedback';
import { Setup } from './pages/Setup';
import { clearTransfer } from './utils/shardStore';

import { getCookie, setCookie } from './utils/cookies';
import { THEMES } from './utils/theme';
import { updateMetaTags, resetMetaTags } from './utils/metaTags';
import { readDirEntry } from './utils/fileSystem';
import { formatFileSize } from './utils/formatUtils';

import { RELAY_SIZE_LIMIT_BYTES, loadResumeSessionMap, removeResumeSession, normalizeResumeSessions, type ResumeSession, RESUME_SESSION_KEY } from './utils/resumeSessions';

function App() {
  const [setupMode, setSetupMode] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/status`)
      .then(res => res.json())
      .then(data => {
        if (data.setupMode) {
          setSetupMode(true);
        } else {
          setSetupMode(false);
          if (data.siteConfig) {
            if (data.siteConfig.siteTitle) document.title = data.siteConfig.siteTitle;
            // The variant preference can be set here if needed, but since it's stored in a cookie, we might leave it for now.
          }
        }
      })
      .catch(err => {
        debugError('Failed to fetch status:', err);
        setSetupMode(false);
      });
  }, []);

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
  const { transferProgress: adaptiveProgress, transferFileAdaptive, prepareDownloadBridge } = useAdaptiveMultiStreamTransfer();

  const {
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
  } = useAppState();

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    globalDragCounter.current += 1;
    if (!(status === 'encrypting' || isProcessingFiles)) {
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
    
    if (status === 'encrypting' || isProcessingFiles) return;

    const { items } = e.dataTransfer;
    if (!items || items.length === 0) return;

    // Set internal processing if we suspect this might take a moment
    if (items.length > 5 || Array.from(items).some(item => item.webkitGetAsEntry?.()?.isDirectory)) {
      setIsProcessingFiles(true);
    }

    try {
      const collected: Array<{ entry: unknown; fallbackFile: File | null }> = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.();
        collected.push({ entry: entry ?? null, fallbackFile: entry ? null : item.getAsFile() });
      }

      const allFiles: File[] = [];
      for (const { entry, fallbackFile } of collected) {
        if ((entry as any)?.isDirectory) {
          allFiles.push(...await readDirEntry(entry as any, (entry as any).name + '/'));
        } else if ((entry as any)?.isFile) {
          const file: File = await new Promise((res, rej) => (entry as any).file(res, rej));
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

  const handleFilePick = () => {
    if (status === 'encrypting' || isProcessingFiles) return;
    debugLog('📂 Triggering global file picker');
    globalFileInputRef.current?.click();
  };

  const handleGlobalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList);
      debugLog('📂 Global input change detected:', files.length, 'files');
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
    
    const handleConnection = (conn: DataConnection) => {
      if (conn.metadata?.type === 'preview') {
        debugLog('Sender: Incoming preview connection from', conn.peer);
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
  const [mooseMessage, setMooseMessage] = useState<string | null>(null);

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
    'You passed the Turing, eh? Share link ready.',
    'Moose approved! Your secure link is ready to go.',
    'The bots are crying oil. You win! Link ready.',
    'Human detected! Access granted. Grab your link below.',
    'No robot detected. You’re the boss. Link ready.',
    'Security moose bows to you. Link created!'
  ];
  const MOOSE_MESSAGES = [
    "No intruders today, eh? I've checked the perimeter and it's looking real good, bud.",
    "Your connection is as solid as a frozen pond in February. All clear!",
    "Encrypted? You betcha! I don't settle for less than maple-syrup-thick security.",
    "Relax, eh. I'm watching the packets like a goalie in the third period. All clear!",
    "A moose never sleeps on the job, sorry. Your data is safe and sound, eh?",
    "Looking for leaks? Not on my watch, oop—just scooting past any potential trouble.",
    "I've sniffed the peer connection. It's cleaner than a fresh sheet of ice, bud.",
    "Safe and sound. Like a moose with a double-double. Everything's lookin' great, eh?",
  ];

  const buildVariantRaw = import.meta.env?.VITE_BUILD_VARIANT?.toLowerCase?.();
  const buildVariant = buildVariantRaw || 'dev';
  const buildVersion = import.meta.env?.VITE_BUILD_VERSION;
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
      debugLog('✅ Share link copied to clipboard automatically');
    } catch (err) {
      debugError('Failed to copy share link:', err);
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
    const pc = conn.peerConnection as RTCPeerConnection | undefined;
    if (!pc || typeof pc.getStats !== 'function') return undefined;

    const stats = await pc.getStats();
    let localCandidateType: string | undefined;
    let remoteCandidateType: string | undefined;
    let localCandidateId: string | undefined;
    let remoteCandidateId: string | undefined;

    stats.forEach((report: RTCStatsReportExt) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
        localCandidateId = report.localCandidateId;
        remoteCandidateId = report.remoteCandidateId;
      }
    });

    if (localCandidateId || remoteCandidateId) {
      stats.forEach((report: RTCStatsReportExt) => {
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
      try { conn.send({ type: 'relay_limit_warning', totalSize }); } catch (err) { debugWarn('Failed to send relay warning:', err); }
      setRelayLimitWarning({ totalSize, isRelay: true });
      conn.close();
      return false;
    }

    // Relay ≤100GB — proceed silently, no popup
    return true;
  };



  useEffect(() => {
    if (import.meta.env?.VITE_E2E) {
      window.__peerConnected = isConnected;
      window.__peerState = connectionState;
      window.__peerId = peerId;
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
        debugLog('No hash present, setting share mode');
        setMode('share');
        resetMetaTags();
      }
      return;
    }

    if (peer && isConnected) {
      if (mode !== 'receive') {
        debugLog('Hash present and peer ready, setting receive mode');
        setMode('receive');
        
        const shortKey = currentHash.substring(1);
        getMetadata(shortKey)
          .then((metadata) => {
            setSenderPeerId(metadata.peerId);
            setIncomingFileInfo({
              name: metadata.fileName,
              size: metadata.fileSize,
              expiresAt: metadata.expiresAt,
              fileType: metadata!.fileType
            });
            setPendingReceive(true);
            setStatus('idle');
            updateMetaTags(metadata);
          })
          .catch((error) => {
            debugError('❌ Failed to fetch metadata:', error);
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
      debugLog('Fetching file list preview...');
      try {
        const previewConn = peer.connect(senderPeerId, { metadata: { type: 'preview' } });
        
        previewConn.on('data', (rawData: unknown) => {
      const data = rawData as TransferMessage;
      
      
          if (data?.type === 'FILE_LIST') {
            debugLog('Received file list preview:', data.files);
            setIncomingFilesList(data.files as File[]);
            previewConn.close();
          }
        });
        
        previewConn.on('error', () => previewConn.close());
        setTimeout(() => previewConn.close(), 10000);
      } catch (err) {
        debugError('Preview connection failed:', err);
      }
    }
  }, [pendingReceive, senderPeerId, peer, isConnected, incomingFilesList]);

  const handleFileSelect = (files: File[]) => {
    debugLog('🎯 handleFileSelect called with:', files.length, 'files');
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
      setIncomingFileInfo({ name: metadata.fileName, size: metadata.fileSize, expiresAt: metadata.expiresAt, fileType: metadata!.fileType });
      setRequiresPin(false);
      setPinModeOverride(null);
      setPendingReceive(true);
    } catch (error: unknown) {
      debugError('❌ PIN verification failed:', error);
      setPinError((error as Error).message || 'Invalid PIN');
      if ((error as Error & { remainingAttempts?: number }).remainingAttempts !== undefined) {
        setRemainingAttempts((error as Error & { remainingAttempts: number }).remainingAttempts);
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleProceedWithTransfer = async (overrideFiles?: File[]) => {
    const files = overrideFiles ?? selectedFiles;
    if (!files || files.length === 0) {
      debugWarn('Attempted to proceed with 0 files');
      return;
    }
    setStatus('encrypting');
    const effectivePin = import.meta.env?.VITE_E2E && e2ePinOverride !== null
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
      debugLog('Files selected:', files.length);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        debugLog(`File ${i}:`, {
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
        debugLog('Detected folder/multiple files');
        
        // If it's a single 0-byte file (likely a folder), we need to handle it differently
        if (files.length === 1 && files[0].size === 0) {
          debugLog('Single 0-byte file detected, likely a folder selection issue');
          throw new Error(`Folder "${files[0].name}" appears to be empty or folder selection failed. Try selecting individual files or a different folder.`);
        }
        
        // Calculate total size
        let totalSize = 0;
        for (let i = 0; i < files.length; i++) {
          totalSize += files[i].size;
        }
        
        // Always use streaming ZIP for folders/multiple files when enabled
        if (true) {
          debugLog('Large folder detected, using streaming ZIP...');
          
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
          
          debugLog('Created ZIP stream for:', zipFileName, formatFileSize(totalSize));
          
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
            debugLog('✅ Share link set and copied to clipboard');
          } catch (error) {
            debugError('❌ Failed to create short link (in catch):', error);
            setTransferErrorMessage(`Failed to create short link: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setStatus('error');
          }
          
          // Wait for receiver connection
          if (peer) {
            let connectionHandled = false;
            peer.on('connection', async (conn) => {
              if (conn.metadata?.type === 'preview') return;
              debugLog('Sender: Incoming connection from receiver:', conn.peer);
              conn.on('open', async () => {
                if (!(await confirmRelayTransfer(conn, totalSize))) {
                  return;
                }
                // Only handle the first successful connection
                if (connectionHandled) {
                  debugLog('Connection already handled, closing additional connection');
                  conn.close();
                  return;
                }
                connectionHandled = true;
                
                debugLog('Sender: Connection open, starting multi-stream ZIP transfer');
                setShowEncryptionIndicator(true);
                setIsEncryptedConnection(true);
                setStatus('transferring');
                try {
                  await transferFileAdaptive(conn, zipStream, zipFileName, totalSize);
                  setStatus('complete');
                } catch (error) {
                  debugError('Multi-stream ZIP transfer failed:', error);
                  setStatus('error');
                }
              });
              
              conn.on('close', () => {
                debugLog('Connection closed with:', conn.peer);
              });
              
              conn.on('error', (error) => {
                debugError('Connection error with:', conn.peer, error);
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
        debugLog('Single file with ZIP enabled, creating streaming ZIP...');
        const file = files[0];
        const { makeZip } = await import('client-zip');
        const zipStream = makeZip([{
          name: file.name,
          lastModified: file.lastModified,
          input: file
        }]);
        const zipFileName = `${file.name}.zip`;
        
        debugLog('Created ZIP stream for single file:', zipFileName);
        
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
          debugError('Failed to create short link:', error);
          setTransferErrorMessage('Failed to create short link. Please try again.');
          setStatus('error');
        }
        
        // Wait for receiver connection
        if (peer) {
          let connectionHandled = false;
          peer.on('connection', async (conn) => {
            if (conn.metadata?.type === 'preview') return;
            debugLog('Sender: Incoming connection from receiver:', conn.peer);
            conn.on('open', async () => {
              if (!(await confirmRelayTransfer(conn, file.size))) {
                return;
              }
              // Only handle the first successful connection
              if (connectionHandled) {
                debugLog('Connection already handled, closing additional connection');
                conn.close();
                return;
              }
              connectionHandled = true;
              
              debugLog('Sender: Connection open, starting stream transfer');
              setShowEncryptionIndicator(true);
              setIsEncryptedConnection(true);
              setStatus('transferring');
              try {
                await transferFileAdaptive(conn, zipStream, zipFileName, file.size);
                setStatus('complete');
              } catch (error) {
                debugError('Multi-stream ZIP transfer failed:', error);
                setStatus('error');
              }
            });
            
            conn.on('close', () => {
              debugLog('Connection closed with:', conn.peer);
            });
            
            conn.on('error', (error) => {
              debugError('Connection error with:', conn.peer, error);
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
      debugError('Share failed:', error);
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
        const dirHandle = await window.showDirectoryPicker?.({
          mode: 'readwrite'
        });
        await handleReceive(dirHandle);
        await startFileReceive(dirHandle);
        return;
      } catch (error) {
        debugWarn('⚠️ Directory picker cancelled, cannot receive multiple files');
        setStatus('error');
        return;
      }
    }

    if ('showSaveFilePicker' in window && incomingFileInfo?.name) {
      try {
        const pickerHandle = await window.showSaveFilePicker?.({
          suggestedName: incomingFileInfo.name,
          types: [{ description: 'All Files', accept: { '*/*': [] } }]
        });
        await handleReceive(pickerHandle);
        await startFileReceive(pickerHandle);
        return;
      } catch (error) {
        debugWarn('⚠️ File picker cancelled, falling back to download bridge');
      }
    }

    let preparedKey: string | null = null;
    if (!isMultiFile && incomingFileInfo?.name && typeof incomingFileInfo.size === 'number') {
      preparedKey = await prepareDownloadBridge(incomingFileInfo.name, incomingFileInfo.size);
      if (!preparedKey) {
        debugError('❌ Download bridge preflight failed, cannot continue');
        setStatus('error');
        return;
      }
      setDownloadKey(preparedKey);
    }

    await handleReceive(null);
    await startFileReceive(null, preparedKey);
  };

  useEffect(() => {
    if (!import.meta.env?.VITE_E2E) return;

    window.__e2e = {
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
      delete window.__e2e;
    };
  }, [shareLink, status, pendingReceive, incomingFileInfo, handleChooseSaveLocation, handleProceedWithTransfer]);

  const handleReceive = async (handle?: unknown) => {
    // Use passed handle or fall back to state
    // null handle is OK - will use traditional download method
    const activeHandle = handle !== undefined ? handle : fileHandle;
    
    if (!senderPeerId) {
      debugError('❌ No sender peer ID available');
      setStatus('error');
      return;
    }
    
    // Store the handle and mark as ready, but don't start transfer yet
    setFileHandle(activeHandle);
    debugLog('📁 Ready to receive file, waiting for user to start download');
  };

  const startFileReceive = async (handle?: unknown, downloadKeyOverride?: string | null) => {
    if (!senderPeerId) {
      debugError('❌ No sender peer ID');
      return;
    }
    
    // Use passed handle or fall back to state
    const activeHandle = handle !== undefined ? handle : fileHandle;
    const activeDownloadKey = downloadKeyOverride !== undefined ? downloadKeyOverride : downloadKey;
    
    try {
      debugLog('Connecting to sender:', senderPeerId, 'with handle:', !!activeHandle);
      const conn = connectToPeer(senderPeerId);
      if (!conn) {
        debugError('Failed to create connection');
        return;
      }
      
      // Wait for connection to open before receiving
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 30000); // 30 second timeout
        
        conn.on('open', () => {
          debugLog('Connection opened, ready to receive');
          setShowEncryptionIndicator(true);
          setIsEncryptedConnection(true);
          clearTimeout(timeout);
          resolve();
        });
        
        conn.on('error', (err) => {
          debugError('Connection error:', err);
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      setStatus('transferring');
      debugLog('Starting file receive...');
      
      // Check if this is multiple files or folder
      const fileType = incomingFileInfo?.fileType;
      debugLog('🔍 File type check:', { fileType, incomingFileInfo });
      
      if (fileType === 'multiple/files' || fileType === 'folder/files') {
        debugLog('Receiving multiple files/folder without ZIP');
        
        if (!activeHandle) {
          // For traditional download, we need to handle multiple files differently
          debugLog('Traditional download for multiple files not yet supported');
          setStatus('error');
          return;
        }
        
        // For File System Access API, we can create a directory
        try {
          const dirHandle = await window.showDirectoryPicker?.({
            mode: 'readwrite'
          });
          
          let fileCount = 0;
          let currentFileHandle: unknown = null;
          let currentWritable: unknown = null;
          
          conn.on('data', async (rawData: unknown) => {
      const data = rawData as TransferMessage;
      
      
            if (data.type === 'metadata') {
              // Close previous file if open
              if (currentWritable) {
                await (currentWritable as FileSystemWritableFileStream).close();
                currentWritable = null;
              }
              
              // Create new file in directory
              currentFileHandle = await dirHandle.getFileHandle(data.name, { create: true });
              currentWritable = await (currentFileHandle as FileSystemFileHandle).createWritable();
              fileCount++;
              
              debugLog(`📁 Receiving file ${fileCount}: ${data.name}`);
              
              // Send acknowledgment
              conn.send({ type: 'file_ready', transferId: data.transferId });
              if ((data as { type?: string }).type === 'relay_limit_warning') {
                setRelayLimitWarning({ totalSize: (data as unknown as { totalSize: number }).totalSize, isRelay: true });
              }
            } else if (data.type === 'chunk' && currentWritable) {
              // Write chunk to current file
              await (currentWritable as FileSystemWritableFileStream).write(data.data as BufferSource);
              
              // Update progress (approximate)
              const fileCountStr = incomingFileInfo?.name?.match(/\d+/)?.[0] || '1';
              const progress = (fileCount / parseInt(fileCountStr)) * 100;
              debugLog(`Progress: ${fileCount}/${fileCountStr} files (${Math.round(progress)}%)`);
            } else if (data.type === 'complete') {
              // Close last file
              if (currentWritable) {
                await (currentWritable as FileSystemWritableFileStream).close();
                currentWritable = null;
              }
              
              debugLog(`✅ All ${fileCount} files received successfully`);
              setStatus('complete');
            }
          });
          
        } catch (error) {
          debugError('Failed to create directory for multiple files:', error);
          setStatus('error');
        }
      } else {
        // Single file
        debugLog('📂 Single file path - Starting adaptive multi-stream download');
        await transferFileAdaptive(conn, null as any as File, undefined, undefined, {
          fileHandle: activeHandle,
          requireSave: true,
          downloadKey: activeDownloadKey
        });

        setStatus('complete');
        debugLog('✅ File saved successfully');
      }
      
      setStatus('complete');
    } catch (error) {
      debugError('Receive failed:', error);
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
              <SharePage 
                shareLink={shareLink}
                selectedFiles={selectedFiles}
                resumeSessions={resumeSessions}
                refreshResumeSessions={refreshResumeSessions}
                handleResumeSenderSession={handleResumeSenderSession}
                handleClearResumeSession={handleClearResumeSession}
                isProcessingFiles={isProcessingFiles}
                setPin={setPin}
                anubisStatusMessage={anubisStatusMessage}
                setSelectedFiles={setSelectedFiles}
                status={status}
                handleProceedWithTransfer={handleProceedWithTransfer}
                relayLimitWarning={relayLimitWarning}
                adaptiveProgress={adaptiveProgress}
                transferErrorMessage={transferErrorMessage}
                isSecure={isEncryptedConnection}
              />
            ) : (
              <ReceivePage 
                resumeSessions={resumeSessions}
                matchesIncomingResume={matchesIncomingResume}
                pendingReceive={pendingReceive}
                handleChooseSaveLocation={handleChooseSaveLocation}
                handleClearResumeSession={handleClearResumeSession}
                status={status}
                adaptiveProgress={adaptiveProgress}
                incomingFileInfo={incomingFileInfo}
                incomingFilesList={incomingFilesList}
                transferErrorMessage={transferErrorMessage}
                isSecure={isEncryptedConnection}
              />
            )}
          </>
        );
    }
  };

  if (setupMode === null) return <div className="h-screen bg-[var(--theme-bg-1)] flex items-center justify-center text-white">Loading...</div>;
  if (setupMode) return <Setup />;

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
        <div className="flex flex-col items-end gap-2">
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
                      onClick={() => setThemePreference(id as "light" | "brighter-dark" | "dark")}
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
              href={`https://${siteDomain}`}
              className="opacity-80 hover:opacity-100 transition-opacity shrink-0 sm:absolute sm:left-0 sm:top-0 sm:mt-1"
              title={siteName}
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
        >
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

          <DropZone
            dragActive={globalDragActive}
            isProcessing={isEncrypting || status === 'encrypting' || isProcessingFiles}
            showUI={currentPage === 'home' && mode === 'share' && !shareLink && !selectedFiles}
            onPickFiles={handleFilePick}
          />
        </main>

        {/* Footer - Inside h-screen to stay at bottom without causing outer scroll */}
        <AppFooter 
          onNavigate={setCurrentPage}
          displayVersion={displayVersion}
          buildIndicatorClass={buildIndicatorClass}
          buildIndicatorLabel={buildIndicatorLabel}
          themePreference={themePreference}
          variantPreference={variantPreference}
          onSetTheme={(t: string) => setThemePreference(t as "light" | "brighter-dark" | "dark")}
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
            <span className="font-medium">Link copied! You're basically a wizard, eh?</span>
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
