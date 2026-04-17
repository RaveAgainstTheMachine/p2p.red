#!/usr/bin/env python3
"""
App.tsx changes:
1. Remove window.confirm relay popup — silent proceed for relay ≤100GB
2. For relay >100GB: set relayLimitWarning state, send signal to peer, don't block
3. Add relayLimitWarning state + banner (shown to sender; receiver gets it via data msg)
4. Upgrade receive preview card (file icon, formatted size, expiry, security note)
5. Remove isAssistedConnection banners from sender transfer view
"""

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Replace confirmRelayTransfer — no window.confirm, just check limit ────
OLD_CONFIRM = """  const confirmRelayTransfer = async (conn: DataConnection, totalSize: number): Promise<boolean> => {
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
  };"""

NEW_CONFIRM = """  const confirmRelayTransfer = async (conn: DataConnection, totalSize: number): Promise<boolean> => {
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
  };"""

if OLD_CONFIRM in content:
    content = content.replace(OLD_CONFIRM, NEW_CONFIRM, 1)
    print("Step 1 done: confirmRelayTransfer updated")
else:
    print("WARN: confirmRelayTransfer not found")

# ── 2. Add relayLimitWarning state after pendingReceive state ─────────────────
OLD_STATE = "  const [pendingReceive, setPendingReceive] = useState<boolean>(false);"
NEW_STATE = """  const [pendingReceive, setPendingReceive] = useState<boolean>(false);
  const [relayLimitWarning, setRelayLimitWarning] = useState<{ totalSize: number; isRelay: boolean } | null>(null);"""

if OLD_STATE in content:
    content = content.replace(OLD_STATE, NEW_STATE, 1)
    print("Step 2 done: relayLimitWarning state added")
else:
    print("WARN: pendingReceive state not found")

# ── 3. Handle relay_limit_warning data message on receiver side ───────────────
# Find where conn.send messages are handled on receiver (look for 'file_ready')
OLD_FILE_READY = "              conn.send({ type: 'file_ready', transferId: data.transferId });"
NEW_FILE_READY = """              conn.send({ type: 'file_ready', transferId: data.transferId });"""

# Find the data handler block to inject relay_limit_warning handling
# Inject after 'file_ready' handling — find the receiver's data handler
RELAY_INJECT_AFTER = "              conn.send({ type: 'file_ready', transferId: data.transferId });\n"
RELAY_INJECT_CONTENT = """              if (data.type === 'relay_limit_warning') {
                setRelayLimitWarning({ totalSize: data.totalSize, isRelay: true });
              }
"""

# Look for a data handler that processes incoming messages on receiver
# Search for pattern near file_ready to inject safely
idx = content.find("conn.send({ type: 'file_ready', transferId: data.transferId });")
if idx != -1:
    # Find the surrounding data handler — look for conn.on('data' near it
    handler_start = content.rfind("conn.on('data'", 0, idx)
    if handler_start != -1:
        # Inject relay_limit_warning check in receiver's data handler
        # Find the closing }); of this data handler
        insert_point = content.find('\n', idx) + 1
        content = content[:insert_point] + RELAY_INJECT_CONTENT + content[insert_point:]
        print("Step 3 done: relay_limit_warning handler injected on receiver")
    else:
        print("WARN: conn.on('data') not found near file_ready")
else:
    print("WARN: file_ready send not found")

# ── 4. Remove isAssistedConnection banners from sender transfer view ──────────
OLD_ASSISTED_SENDER = """                      {isAssistedConnection && (
                        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4 text-white/80">
                          <div className="text-white/90 font-medium">Connection assist: engaged</div>
                          <div className="mt-1 text-sm text-white/70">Still end-to-end encrypted. We can't read your files and we never store them.</div>
                        </div>
                      )}"""

if OLD_ASSISTED_SENDER in content:
    content = content.replace(OLD_ASSISTED_SENDER, '', 1)
    print("Step 4a done: sender isAssistedConnection banner removed")
else:
    print("WARN: sender assisted banner 1 not found")

OLD_ASSISTED_RECEIVER = """                  {isAssistedConnection && (
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
                        </details>"""

if OLD_ASSISTED_RECEIVER in content:
    content = content.replace(OLD_ASSISTED_RECEIVER, '', 1)
    print("Step 4b done: receiver isAssistedConnection banner removed")
else:
    print("WARN: receiver assisted banner not found")

# ── 5. Replace receive preview block (pendingReceive && incomingFileInfo) ─────
OLD_PREVIEW = """              {pendingReceive && incomingFileInfo && (
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
               )}"""

NEW_PREVIEW = """              {pendingReceive && incomingFileInfo && (
                <div className="animate-fade-up">
                  {/* Relay limit warning — shown when connection is relay AND size >100GB */}
                  {relayLimitWarning && (
                    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-amber-400 text-xl flex-shrink-0">⚠️</div>
                        <div className="flex-1">
                          <p className="text-amber-200 font-semibold">Relay limit exceeded</p>
                          <p className="text-amber-200/70 text-sm mt-1">
                            This transfer ({formatFileSize(relayLimitWarning.totalSize)}) exceeds the 100 GB relay limit.
                            The sender's network is routing through a relay — a direct connection would remove this limit.
                          </p>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm text-amber-300/80 hover:text-amber-200 transition-colors">Connection tips</summary>
                            <ul className="mt-2 space-y-1 text-sm text-amber-200/60 list-disc list-inside">
                              <li>Sender: disable VPN/proxy and refresh</li>
                              <li>Try a different network (home Wi-Fi vs hotspot)</li>
                              <li>Enable UPnP on home router (if comfortable)</li>
                              <li>Ensure UDP/WebRTC allowed by firewall</li>
                            </ul>
                          </details>
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-3 px-4 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-200 text-sm hover:bg-amber-500/25 transition-colors"
                          >
                            Refresh to try again
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File preview card */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/20 text-2xl">
                        {incomingFileInfo.fileType?.startsWith('image/') ? '🖼️' :
                         incomingFileInfo.fileType?.startsWith('video/') ? '🎬' :
                         incomingFileInfo.fileType?.startsWith('audio/') ? '🎵' :
                         incomingFileInfo.fileType?.includes('zip') || incomingFileInfo.fileType?.includes('tar') || incomingFileInfo.fileType?.includes('gzip') ? '📦' :
                         incomingFileInfo.fileType?.includes('pdf') ? '📄' :
                         incomingFileInfo.fileType?.includes('text') ? '📝' :
                         '📁'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-lg leading-tight truncate" title={incomingFileInfo.name}>
                          {incomingFileInfo.name}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          <span className="text-white/50 text-sm">{formatFileSize(incomingFileInfo.size)}</span>
                          {incomingFileInfo.fileType && (
                            <span className="text-white/30 text-sm">{incomingFileInfo.fileType}</span>
                          )}
                          {incomingFileInfo.expiresAt && (
                            <span className="text-white/40 text-sm">🕐 {formatExpirationTime(incomingFileInfo.expiresAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Security notice */}
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-xs text-white/40">
                      🔒 End-to-end encrypted · Not stored on servers · Direct transfer from sender's browser
                    </div>
                  </div>

                  <div className="max-w-md mx-auto mb-4">
                    <FileTypeWarning fileName={incomingFileInfo.name} />
                  </div>

                  {resumeSessions.some((session) => session.role === 'receiver' && matchesIncomingResume(session)) && (
                    <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-white/90 font-medium">Resume detected</div>
                      <div className="text-sm text-white/60 mt-1">Cached shards found — resume to skip verified parts.</div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={handleChooseSaveLocation} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm">Resume download</button>
                        <button type="button" onClick={() => {
                          const match = resumeSessions.find((s) => s.role === 'receiver' && matchesIncomingResume(s));
                          if (match) void handleClearResumeSession(match);
                        }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm">Start fresh</button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleChooseSaveLocation}
                    disabled={!!relayLimitWarning}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-semibold transition-colors shadow-lg text-lg"
                  >
                    <Download size={20} className="inline mr-2 -mt-0.5" />
                    Download
                  </button>
                  <p className="text-white/30 mt-3 text-sm text-center">
                    Your browser will ask where to save it.
                  </p>
                </div>
              )}"""

if OLD_PREVIEW in content:
    content = content.replace(OLD_PREVIEW, NEW_PREVIEW, 1)
    print("Step 5 done: receive preview upgraded")
else:
    print("WARN: old receive preview not found — check indentation")
    idx = content.find("pendingReceive && incomingFileInfo")
    print(f"  pendingReceive found at idx={idx}")

# ── 6. Add relayLimitWarning banner for sender (in shareLink block) ───────────
# Inject before the ShareLink component render
OLD_SHARELINK = "                  <ShareLink shareLink={shareLink} />"
NEW_SHARELINK = """                  {relayLimitWarning && (
                    <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-amber-400 text-xl flex-shrink-0">⚠️</div>
                        <div className="flex-1">
                          <p className="text-amber-200 font-semibold">Relay size limit exceeded</p>
                          <p className="text-amber-200/70 text-sm mt-1">
                            Your transfer ({formatFileSize(relayLimitWarning.totalSize)}) is over the 100 GB relay cap.
                            The recipient has been notified. Improve your connection or reduce file size and start a new share.
                          </p>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm text-amber-300/80 hover:text-amber-200 transition-colors">Tips to get a direct connection</summary>
                            <ul className="mt-2 space-y-1 text-sm text-amber-200/60 list-disc list-inside">
                              <li>Disable VPN/proxy and refresh</li>
                              <li>Try home Wi-Fi instead of corporate/mobile network</li>
                              <li>Enable UPnP on your router (if comfortable)</li>
                              <li>Ensure UDP/WebRTC is not blocked by your firewall</li>
                            </ul>
                          </details>
                          <button type="button" onClick={() => window.location.reload()} className="mt-3 px-4 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-200 text-sm hover:bg-amber-500/25 transition-colors">
                            Refresh &amp; create new share
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <ShareLink shareLink={shareLink} />"""

if OLD_SHARELINK in content:
    content = content.replace(OLD_SHARELINK, NEW_SHARELINK, 1)
    print("Step 6 done: sender relay warning banner added")
else:
    print("WARN: ShareLink render not found")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone. Size: {len(content)} bytes")
