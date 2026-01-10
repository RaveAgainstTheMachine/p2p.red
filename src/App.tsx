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
import { createStreamingZip } from './utils/streamingZip';
import { createShortLink, getMetadata } from './services/metadataApi';
import { PinToggle } from './components/PinToggle';
import { PinVerification } from './components/PinVerification';

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
      
      if (isFolderSelection) {
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
        
        // For large folders (>100MB), use streaming ZIP to avoid memory issues
        if (totalSize > 100 * 1024 * 1024) {
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
            }, pin || undefined);
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
        } else {
          console.log('Creating ZIP for folder...');
          fileToTransfer = await createStreamingZip(files);
          console.log('Created ZIP file:', fileToTransfer.name, formatFileSize(fileToTransfer.size));
        }
      } else {
        // Single file
        console.log('Single file detected, using directly');
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
        const shortKey = await createShortLink({
          peerId: peerId!,
          fileName: fileToTransfer.name,
          fileSize: fileToTransfer.size,
          fileType: fileToTransfer.type
        }, pin || undefined);
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      {/* Animated background */}
      <div className="fixed inset-0 bg-black/20" />
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
      
      <div className="relative z-10 mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SHARE FILES QUICKLY & SECURELY
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
    </div>
  );
}

export default App;
