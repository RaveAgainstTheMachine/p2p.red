import { useState, useEffect } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { useEncryption } from './hooks/useEncryption';
import { useFileTransfer } from './hooks/useFileTransfer';
import { DropZone } from './components/DropZone';
import { ShareLink } from './components/ShareLink';
import { EnhancedProgressBar } from './components/EnhancedProgressBar';
import { ResumeButton } from './components/ResumeButton';
import { EncryptionIndicator } from './components/EncryptionIndicator';
import { Download, Share2, Shield, CheckCircle, File } from 'lucide-react';
import { createShortLink, getMetadata } from './services/metadataApi';
import { PinToggle } from './components/PinToggle';
import { PinVerification } from './components/PinVerification';
import { FileTypeWarning } from './components/FileTypeWarning';
import { TrustBadges } from './components/TrustBadges';
import { CookieBanner } from './components/CookieBanner';
import { Monitoring } from './components/Monitoring';
import { Legal } from './pages/Legal';
import { Info } from './pages/Info';

function App() {
  const { peer, peerId, isConnected, connectionState, isOnline, initializePeer, connectToPeer } = useWebRTC();
  const { isEncrypting } = useEncryption();
  const { transferProgress, isTransferring, sendFile, sendStream, receiveFile, resumeTransfer } = useFileTransfer();
  const [mode, setMode] = useState<'share' | 'receive'>('share');
  const [shareLink, setShareLink] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'encrypting' | 'waiting' | 'connecting' | 'transferring' | 'complete' | 'error'>('idle');
  const [senderPeerId, setSenderPeerId] = useState<string>('');
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [pendingReceive, setPendingReceive] = useState<boolean>(false);
  const [incomingFileInfo, setIncomingFileInfo] = useState<{name: string; size: number} | null>(null);
  const [isEncryptedConnection, setIsEncryptedConnection] = useState<boolean>(false);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [requiresPin, setRequiresPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>(undefined);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'legal' | 'info'>('home');
  const [enableZip, setEnableZip] = useState<boolean>(true);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    initializePeer();
  }, [initializePeer]);

  useEffect(() => {
    console.log('🔍 Mode detection useEffect running:', {
      hasHash: !!window.location.hash,
      hash: window.location.hash,
      hasPeer: !!peer,
      isConnected,
      connectionState,
      currentMode: mode
    });
    
    // Auto-detect mode: receive if hash present, otherwise share
    if (window.location.hash && peer && isConnected) {
      console.log('📥 Hash detected and peer ready, fetching metadata...');
      setMode('receive');
      
      const shortKey = window.location.hash.substring(1);
      console.log('Short key:', shortKey);
      
      // Fetch metadata from API
      getMetadata(shortKey)
        .then(metadata => {
          console.log('📦 Retrieved metadata:', metadata);
          setSenderPeerId(metadata.peerId);
          setIncomingFileInfo({ name: metadata.fileName, size: metadata.fileSize });
          setPendingReceive(true);
        })
        .catch((error: any) => {
          console.error('❌ Failed to retrieve metadata:', error);
          if (error.requiresPin) {
            setRequiresPin(true);
          } else {
            setStatus('error');
          }
        });
    } else if (!window.location.hash) {
      console.log('No hash present, setting share mode');
      setMode('share');
    } else {
      console.log('⏳ Waiting for peer connection...', {
        hasPeer: !!peer,
        isConnected,
        connectionState
      });
    }
  }, [peer, isConnected, connectionState]);

  const handleFileSelect = (files: FileList) => {
    setSelectedFiles(files);
  };

  const handlePinVerification = async (enteredPin: string) => {
    setIsVerifyingPin(true);
    setPinError('');
    
    const shortKey = window.location.hash.substring(1);
    
    try {
      const metadata = await getMetadata(shortKey, enteredPin);
      console.log('📦 Retrieved metadata with PIN:', metadata);
      setSenderPeerId(metadata.peerId);
      setIncomingFileInfo({ name: metadata.fileName, size: metadata.fileSize });
      setRequiresPin(false);
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

  const handleProceedWithTransfer = async () => {
    if (!selectedFiles) return;
    console.log('🔐 PIN state before transfer:', { pin, hasPin: !!pin, pinLength: pin?.length });
    setStatus('encrypting');
    const files = selectedFiles;
    
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
      
      let fileToTransfer: File;
      
      // Check if this is a folder selection or multiple files
      const isFolderSelection = files.length > 1 || 
        (files.length === 1 && files[0].webkitRelativePath && files[0].webkitRelativePath.includes('/')) ||
        (files.length === 1 && files[0].size === 0 && files[0].name && !files[0].type);
      
      // Use streaming ZIP for all files if enabled (default), unless single file and ZIP disabled
      const shouldZip = enableZip && (isFolderSelection || files.length > 0);
      
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
            const pinToSend = pin && pin.length === 4 ? pin : undefined;
            console.log('📤 Creating short link with PIN:', { hasPin: !!pinToSend, pinLength: pinToSend?.length });
            const shortKey = await createShortLink({
              peerId: peerId!,
              fileName: zipFileName,
              fileSize: totalSize,
              fileType: 'application/zip'
            }, pinToSend);
            const shareLink = `${window.location.origin}${window.location.pathname}#${shortKey}`;
            setShareLink(shareLink);
            setStatus('waiting');
          } catch (error) {
            console.error('Failed to create short link:', error);
            setStatus('error');
            return;
          }
          
          // Wait for receiver connection
          if (peer) {
            peer.on('connection', async (conn) => {
              console.log('Sender: Incoming connection from receiver:', conn.peer);
              conn.on('open', async () => {
                console.log('Sender: Connection open, starting stream transfer');
                setShowEncryptionIndicator(true);
                setIsEncryptedConnection(true);
                setStatus('transferring');
                try {
                  await sendStream(conn, zipStream, zipFileName, totalSize);
                  setStatus('complete');
                } catch (error) {
                  console.error('Stream transfer failed:', error);
                  setStatus('error');
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
          const pinToSend = pin && pin.length === 4 ? pin : undefined;
          console.log('📤 Creating short link with PIN:', { hasPin: !!pinToSend, pinLength: pinToSend?.length });
          const shortKey = await createShortLink({
            peerId: peerId!,
            fileName: zipFileName,
            fileSize: file.size,
            fileType: 'application/zip'
          }, pinToSend);
          const shareLink = `${window.location.origin}${window.location.pathname}#${shortKey}`;
          setShareLink(shareLink);
          setStatus('waiting');
        } catch (error) {
          console.error('Failed to create short link:', error);
          setStatus('error');
          return;
        }
        
        // Wait for receiver connection
        if (peer) {
          peer.on('connection', async (conn) => {
            console.log('Sender: Incoming connection from receiver:', conn.peer);
            conn.on('open', async () => {
              console.log('Sender: Connection open, starting stream transfer');
              setShowEncryptionIndicator(true);
              setIsEncryptedConnection(true);
              setStatus('transferring');
              try {
                await sendStream(conn, zipStream, zipFileName, file.size);
                setStatus('complete');
              } catch (error) {
                console.error('Stream transfer failed:', error);
                setStatus('error');
              }
            });
          });
        }
        return;
      } else {
        // Single file without ZIP
        console.log('Single file without ZIP, using directly');
        fileToTransfer = files[0];
        console.log('Single file details:', {
          name: fileToTransfer.name,
          size: fileToTransfer.size,
          type: fileToTransfer.type
        });
      }
      
      // Validate file - allow empty files if it's an archive (folder)
      if (!fileToTransfer) {
        throw new Error('No file to transfer');
      }
      
      // Only reject empty files if they're not archives (single empty files)
      if (fileToTransfer.size === 0 && !fileToTransfer.name.includes('.archive') && !fileToTransfer.name.includes('.zip')) {
        throw new Error(`Invalid file: ${fileToTransfer.name} (0 bytes)`);
      }
      
      // Create short link via metadata API
      try {
        const pinToSend = pin && pin.length === 4 ? pin : undefined;
        console.log('📤 Creating short link with PIN:', { hasPin: !!pinToSend, pinLength: pinToSend?.length });
        const shortKey = await createShortLink({
          peerId: peerId!,
          fileName: fileToTransfer.name,
          fileSize: fileToTransfer.size,
          fileType: fileToTransfer.type
        }, pinToSend);
        const link = `${window.location.origin}${window.location.pathname}#${shortKey}`;
        setShareLink(link);
        setStatus('waiting');
      } catch (error) {
        console.error('Failed to create short link:', error);
        setStatus('error');
        return;
      }
      
      // Listen for incoming connection
      if (peer) {
        peer.on('connection', async (conn) => {
          console.log('Sender: Incoming connection from receiver:', conn.peer);
          conn.on('open', async () => {
            console.log('Sender: Connection open, starting file transfer');
            setShowEncryptionIndicator(true);
            setIsEncryptedConnection(true);
            setStatus('transferring');
            await sendFile(conn, fileToTransfer);
            setStatus('complete');
          });
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      setStatus('error');
    }
  };

  const handleChooseSaveLocation = async () => {
    // Use incoming file info from metadata API
    const fileName = incomingFileInfo?.name || 'download';
    
    // ALWAYS prompt for File System Access - never use RAM
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Files',
            accept: { '*/*': [] }
          }]
        });
        setFileHandle(handle);
        console.log('File save location chosen, starting receive...');
        
        // Start receive only after file handle is obtained
        setPendingReceive(false);
        handleReceive(handle);
      } catch (err) {
        console.error('User cancelled save dialog - cannot proceed without save location:', err);
        setStatus('error');
        // Do NOT continue without file handle
      }
    } else {
      console.error('File System Access API not supported - cannot receive files');
      setStatus('error');
    }
  };

  const handleReceive = async (handle?: any) => {
    // Use passed handle or fall back to state
    const activeHandle = handle || fileHandle;
    
    // senderPeerId already set by metadata API
    if (!senderPeerId) {
      console.error('No sender peer ID available');
      setStatus('error');
      return;
    }
    
    if (!activeHandle) {
      console.error('No file handle available');
      setStatus('error');
      return;
    }
    
    console.log('Connecting to sender:', senderPeerId);
    setStatus('connecting');
    
    try {
      if (!peer) {
        console.error('Peer not initialized yet');
        return;
      }
      
      console.log('Connecting to remote peer:', senderPeerId);
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
      const received = await receiveFile(conn, new Set(), activeHandle);
      console.log('File received:', received.name, received.size);
      
      // For streaming writes, file is already on disk
      if (activeHandle && received.data.size === 0) {
        console.log('File already written to disk via streaming');
        setStatus('complete');
      } else {
        // Download file from memory
        console.log('Downloading file from memory...');
        const blob = received.data;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = incomingFileInfo?.name || 'download';
        a.click();
        URL.revokeObjectURL(url);
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
  if (currentPage === 'legal') {
    return <Legal onBack={() => setCurrentPage('home')} />;
  }
  
  if (currentPage === 'info') {
    return <Info onBack={() => setCurrentPage('home')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex flex-col">
      {/* Animated background */}
      <div className="fixed inset-0 bg-black/20" />
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
      
      <div className="relative z-10 mx-auto px-4 py-6 max-w-7xl flex-1">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SHARE FILES SECURELY
          </h1>
          <p className="text-white/80 text-base">
            Privacy-first file sharing with true peer-to-peer transfer
          </p>
          
          {/* Connection Status Alerts */}
          {!isOnline && (
            <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-400 font-semibold text-center">
                🌐 No Internet Connection
              </p>
              <p className="text-red-300 text-sm text-center mt-1">
                Check your network connection
              </p>
            </div>
          )}
          
          {connectionState === 'reconnecting' && isOnline && (
            <div className="mt-4 bg-yellow-500/20 border-2 border-yellow-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-400 font-semibold text-center">
                🔄 Reconnecting...
              </p>
              <p className="text-yellow-300 text-sm text-center mt-1">
                Attempting to restore connection
              </p>
            </div>
          )}
          
          {connectionState === 'failed' && (
            <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-400 font-semibold text-center">
                ❌ Connection Failed
              </p>
              <p className="text-red-300 text-sm text-center mt-1">
                Unable to establish connection. Refresh the page to try again.
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
            />
          </div>
        ) : mode === 'share' ? (
          <div className="glass-card p-8" style={{ minHeight: '200px' }}>
            {!shareLink ? (
              <>
                <DropZone 
                  onFileSelect={handleFileSelect} 
                  isProcessing={isEncrypting || status === 'encrypting'}
                />
                {selectedFiles && (
                  <div className="flex flex-col gap-6 mt-6">
                    {/* File Details */}
                    <div className="flex items-center justify-center gap-3 text-white/80">
                      <File size={20} className="text-blue-400" />
                      <div className="text-center">
                        <p className="font-medium">{selectedFiles[0].name}</p>
                        <p className="text-sm text-white/60">
                          {formatFileSize(selectedFiles.length > 1 
                            ? Array.from(selectedFiles).reduce((sum, f) => sum + f.size, 0)
                            : selectedFiles[0].size
                          )}
                          {selectedFiles.length > 1 && ` • ${selectedFiles.length} files`}
                        </p>
                      </div>
                    </div>

                    {/* ZIP Toggle */}
                    <div className="flex items-center justify-center gap-2 text-white/80">
                      <button
                        type="button"
                        onClick={() => setEnableZip(!enableZip)}
                        className="flex items-center gap-2 text-sm hover:text-white transition-colors"
                      >
                        <div className={`w-10 h-6 rounded-full transition-colors ${
                          enableZip ? 'bg-blue-500' : 'bg-white/20'
                        } relative`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            enableZip ? 'translate-x-5' : 'translate-x-1'
                          }`} />
                        </div>
                        <span>Compress as ZIP</span>
                      </button>
                    </div>

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
                        onClick={handleProceedWithTransfer}
                        className="btn-primary"
                        disabled={status === 'encrypting'}
                      >
                        {status === 'encrypting' ? 'Processing...' : 'Create Share Link'}
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
                    <div className="inline-flex items-center gap-2 text-white/60">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span>Waiting for recipient to connect...</span>
                    </div>
                  </div>
                )}
                
                {status === 'transferring' && (
                  <div className="w-full">
                    <EnhancedProgressBar 
                      progress={transferProgress} 
                      label="Transferring file" 
                      showETA={true}
                      showSpeed={true}
                    />
                  </div>
                )}
                
                {status === 'complete' && (
                  <div className="text-center">
                    <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white">
                      File transferred successfully!
                    </h3>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-8">
            <div>
              {status === 'connecting' && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/80">Connecting to peer...</p>
                </div>
              )}
              
              {status === 'transferring' && (
                <div className="mt-8 max-w-5xl mx-auto">
                  <EnhancedProgressBar 
                    progress={transferProgress} 
                    label="Receiving file"
                    showETA={true}
                    showSpeed={true}
                  />
                  
                  {!isTransferring && transferProgress.percentage > 0 && transferProgress.percentage < 100 && (
                    <div className="text-center mt-4">
                      <p className="text-yellow-400 mb-2">Transfer interrupted</p>
                      <ResumeButton
                        onClick={() => {
                          const resumeFromChunk = Math.floor(transferProgress.bytesTransferred / (64 * 1024));
                          handleResume(resumeFromChunk);
                        }}
                        disabled={false}
                        progress={transferProgress.percentage}
                      />
                    </div>
                  )}
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-w-md mx-auto mb-6">
                    <FileTypeWarning fileName={incomingFileInfo.name} />
                  </div>
                  
                  <button
                    onClick={handleChooseSaveLocation}
                    className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors shadow-lg"
                  >
                    Start Download
                  </button>
                  <p className="text-white/60 mt-4 text-sm">
                    You'll be prompted to choose save location
                  </p>
                </div>
              )}
              
              {status === 'idle' && !pendingReceive && (
                <div>
                  <Download size={64} className="text-white/40 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Waiting for share link...
                  </h3>
                  <p className="text-white/60">
                    Open a share link to receive files
                  </p>
                </div>
              )}
              
              {status === 'error' && (
                <div>
                  <div className="text-6xl mb-4">❌</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Connection failed
                  </h3>
                  <p className="text-white/60 mb-4">
                    Please check the share link and try again
                  </p>
                  {transferProgress.percentage > 0 && transferProgress.percentage < 100 && (
                    <div className="flex justify-center mt-4">
                      <ResumeButton
                        onClick={() => {
                          const resumeFromChunk = Math.floor(transferProgress.bytesTransferred / (64 * 1024));
                          handleResume(resumeFromChunk);
                        }}
                        disabled={false}
                        progress={transferProgress.percentage}
                      />
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
            <h3 className="text-lg font-semibold text-white mb-2">True Peer-to-Peer</h3>
            <p className="text-white/60 text-sm">
              Direct browser-to-browser transfer. No server relay.
            </p>
          </div>
          
          <div className="glass-card p-6 text-center">
            <Shield className="text-purple-400 mx-auto mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">End-to-End Encrypted</h3>
            <p className="text-white/60 text-sm">
              Files encrypted in your browser before transfer
            </p>
          </div>
          
          <div className="glass-card p-6 text-center">
            <Share2 className="text-pink-400 mx-auto mb-4" size={32} />
            <h3 className="text-lg font-semibold text-white mb-2">Simple Sharing</h3>
            <p className="text-white/60 text-sm">
              Just share a link. No signup required.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto py-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-4">
            <TrustBadges />
            
            <a
              href="https://www.buymeacoffee.com/p2pred"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z"/>
              </svg>
              Support Development
            </a>
            
            <p> 2026 p2p.red</p>
            <div className="flex gap-4 text-sm text-white/60">
              <button
                onClick={() => setCurrentPage('info')}
                className="hover:text-white transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => setCurrentPage('legal')}
                className="hover:text-white transition-colors"
              >
                Legal & Privacy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Cookie/Privacy Banner */}
      <CookieBanner />
      
      {/* Monitoring */}
      <Monitoring />
    </div>
  );
}

export default App;
