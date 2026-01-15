import { useCallback, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'

type NatTraversalSummary = {
  consent_granted: boolean
  natpmp_attempted: boolean
  natpmp_status?: string | null
  upnp_attempted: boolean
  upnp_status?: string | null
  external_ip?: string | null
}

type Share = {
  id: string
  name: string
  sizeLabel: string
  status: 'online' | 'paused' | 'offline' | 'pending-approval' | 'limit-reached'
  protectedWithPassword?: boolean
  approvalRequired?: boolean
  expires?: string
  maxDownloads?: number | null
  downloadsUsed?: number
  geoRule?: string
}

type Approval = {
  id: string
  name: string
  sizeLabel: string
  reason: string
}

const seedShares: Share[] = [
  {
    id: '1',
    name: 'Design-assets.zip',
    sizeLabel: '1.2 GB',
    status: 'online',
    protectedWithPassword: true,
    approvalRequired: false,
    expires: '23h',
    maxDownloads: 25,
    downloadsUsed: 6,
    geoRule: 'Allow: US, CA, EU',
  },
  {
    id: '2',
    name: 'Client-video.mov',
    sizeLabel: '840 MB',
    status: 'pending-approval',
    approvalRequired: true,
    expires: '2d',
    maxDownloads: 3,
    downloadsUsed: 3,
  },
  {
    id: '3',
    name: 'Multi-share: product launch',
    sizeLabel: '4 items',
    status: 'paused',
    approvalRequired: true,
    expires: 'perma-share',
    maxDownloads: null,
    downloadsUsed: 18,
  },
]

const seedApprovals: Approval[] = [
  { id: 'a1', name: 'Client-video.mov', sizeLabel: '840 MB', reason: 'Requester awaiting approval' },
  { id: 'a2', name: 'Specs.pdf', sizeLabel: '2.1 MB', reason: 'Password provided; needs approval' },
]

type NavTab = 'dashboard' | 'approvals' | 'diagnostics' | 'settings'

function App() {
  const [shares] = useState<Share[]>(seedShares)
  const [approvals] = useState<Approval[]>(seedApprovals)
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [consented, setConsented] = useState(false)
  const [isRunningProbe, setIsRunningProbe] = useState(false)
  const [probeResult, setProbeResult] = useState<NatTraversalSummary | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [wipeStatus, setWipeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [wipeError, setWipeError] = useState<string | null>(null)
  const [diagnostics] = useState({
    candidateType: 'unknown', // host / srflx / prflx / relay
    transport: 'unknown', // udp / tcp / tls
    relayAssisted: false, // true if relay observed
    rttMs: null as number | null,
    packetLoss: null as number | null,
    activeStreams: 0,
  })

  const onlineCount = useMemo(() => shares.filter(s => s.status === 'online').length, [shares])
  const pendingApprovals = useMemo(() => shares.filter(s => s.status === 'pending-approval').length, [shares])
  const limitReached = useMemo(() => shares.filter(s => s.status === 'limit-reached').length, [shares])

  const runProbe = useCallback(async () => {
    setIsRunningProbe(true)
    setProbeError(null)
    try {
      const data = await invoke<NatTraversalSummary>('nat_traversal_probe', { consent: consented })
      setProbeResult(data)
    } catch (err) {
      console.error('NAT traversal probe failed', err)
      setProbeError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunningProbe(false)
    }
  }, [consented])

  const runSecureWipe = useCallback(async () => {
    if (!window.confirm('This will remove local app data/cache. Continue?')) return
    setWipeStatus('running')
    setWipeError(null)
    try {
      await invoke('secure_wipe')
      setWipeStatus('done')
    } catch (err) {
      setWipeStatus('error')
      setWipeError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  const statusLabel = (share: Share) => {
    switch (share.status) {
      case 'online':
        return 'Online'
      case 'paused':
        return 'Paused'
      case 'offline':
        return 'Offline'
      case 'pending-approval':
        return 'Pending approval'
      case 'limit-reached':
        return 'Download limit reached'
      default:
        return share.status
    }
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <div className="brand">
          <div className="logo-circle">P</div>
          <div>
            <div className="brand-name">p2p.red</div>
            <div className="brand-sub">Desktop</div>
          </div>
        </div>
        <div className="status-block">
          <div className="status-dot online" />
          <div>
            <div className="status-title">Online</div>
            <div className="status-sub">Encrypted · No IDs</div>
          </div>
        </div>
        <div className="nav-group">
          <div className="nav-label">Navigate</div>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-btn ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
            Approvals {pendingApprovals > 0 ? `(${pendingApprovals})` : ''}
          </button>
          <button className={`nav-btn ${activeTab === 'diagnostics' ? 'active' : ''}`} onClick={() => setActiveTab('diagnostics')}>
            Diagnostics
          </button>
          <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            Settings
          </button>
        </div>
        <div className="nav-group">
          <div className="nav-label">Quick actions</div>
          <button className="primary-block">New share</button>
          <button className="ghost-block">New multi-share</button>
        </div>
        <div className="nav-summary">
          <div>Online: {onlineCount}</div>
          <div>Pending: {pendingApprovals}</div>
          <div>Limits reached: {limitReached}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="top-strip">
          <div className="strip-left">
            <div className="strip-title">Secure P2P shares</div>
            <div className="strip-sub">True P2P · End-to-end encrypted · No identifiers</div>
          </div>
          <div className="strip-actions">
            <button className="ghost">Pause all</button>
            <button className="ghost">Stop all</button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Active shares</div>
                <div className="panel-sub">Manage status, limits, approvals, and protections.</div>
              </div>
              <div className="panel-actions">
                <button className="ghost">Clear stats</button>
                <button className="ghost">Delete all (metadata)</button>
              </div>
            </div>
            <div className="table">
              <div className="table-head">
                <div>Name</div>
                <div>Status</div>
                <div>Protection</div>
                <div>Downloads</div>
                <div>Expiry</div>
                <div>Actions</div>
              </div>
              {shares.map((share) => (
                <div className="table-row" key={share.id}>
                  <div>
                    <div className="row-title">{share.name}</div>
                    <div className="row-sub">{share.sizeLabel}</div>
                  </div>
                  <div><span className={`chip status-${share.status}`}>{statusLabel(share)}</span></div>
                  <div className="row-sub">
                    {share.approvalRequired ? 'Approval' : 'Open'} · {share.protectedWithPassword ? 'Password' : 'No password'}
                  </div>
                  <div>
                    {typeof share.maxDownloads === 'number'
                      ? `${share.downloadsUsed ?? 0}/${share.maxDownloads}`
                      : 'Unlimited'}
                  </div>
                  <div className="row-sub">{share.expires ?? 'No expiry'}</div>
                  <div className="row-actions">
                    <button className="ghost">Toggle</button>
                    <button className="ghost">Pause</button>
                    <button className="ghost">Delete meta</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'approvals' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Approvals</div>
                <div className="panel-sub">Approve or deny incoming requests; respects download caps.</div>
              </div>
              <div className="panel-actions">
                <button className="ghost">Approve all</button>
              </div>
            </div>
            <div className="table">
              <div className="table-head">
                <div>Name</div>
                <div>Size</div>
                <div>Reason</div>
                <div>Actions</div>
              </div>
              {approvals.map((req) => (
                <div className="table-row" key={req.id}>
                  <div className="row-title">{req.name}</div>
                  <div className="row-sub">{req.sizeLabel}</div>
                  <div className="row-sub">{req.reason}</div>
                  <div className="row-actions">
                    <button className="primary">Approve</button>
                    <button className="ghost">Deny</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'diagnostics' && (
          <div className="panel-stack">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">NAT-PMP / UPnP probe</div>
                  <div className="panel-sub">Optional; consent required. Attempts public IP and a short-lived UDP mapping.</div>
                </div>
                <div className="panel-actions">
                  <label className="switch-inline">
                    <input
                      type="checkbox"
                      checked={consented}
                      onChange={(e) => setConsented(e.target.checked)}
                    />
                    <span className="row-sub">Consent to probe</span>
                  </label>
                  <button className="primary" onClick={runProbe} disabled={isRunningProbe}>
                    {isRunningProbe ? 'Probing…' : 'Run probe'}
                  </button>
                </div>
              </div>
              {probeError && <div className="alert error">Probe error: {probeError}</div>}
              {probeResult && (
                <div className="diag-grid">
                  <div><div className="label">Consent</div><div>{probeResult.consent_granted ? 'Granted' : 'Not granted'}</div></div>
                  <div><div className="label">NAT-PMP</div><div>{probeResult.natpmp_attempted ? probeResult.natpmp_status ?? 'No status' : 'Skipped'}</div></div>
                  <div><div className="label">UPnP</div><div>{probeResult.upnp_attempted ? probeResult.upnp_status ?? 'No status' : 'Skipped'}</div></div>
                  <div><div className="label">External IP</div><div>{probeResult.external_ip ?? 'Unknown'}</div></div>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">ICE / relay status</div>
                  <div className="panel-sub">Non-identifying diagnostics: candidate type, transport, relay, RTT, loss, streams.</div>
                </div>
              </div>
              <div className="diag-grid">
                <div><div className="label">Candidate</div><div>{diagnostics.candidateType}</div></div>
                <div><div className="label">Transport</div><div>{diagnostics.transport}</div></div>
                <div><div className="label">Relay</div><div>{diagnostics.relayAssisted ? 'Yes (TURN)' : 'No relay observed'}</div></div>
                <div><div className="label">RTT</div><div>{diagnostics.rttMs !== null ? `${diagnostics.rttMs} ms` : 'N/A'}</div></div>
                <div><div className="label">Packet loss</div><div>{diagnostics.packetLoss !== null ? `${diagnostics.packetLoss}%` : 'N/A'}</div></div>
                <div><div className="label">Active streams</div><div>{diagnostics.activeStreams}</div></div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="panel-stack">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">Privacy notice</div>
                <div className="panel-sub">No user-identifying data. E2E encryption for transfers. TLS signaling. Aggregate-only stats.</div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">Secure wipe</div>
                  <div className="panel-sub">Remove local data/cache and scrub memory (best-effort). Does not touch your files.</div>
                </div>
                <div className="panel-actions">
                  <button className="ghost" disabled={wipeStatus === 'running'} onClick={runSecureWipe}>
                    {wipeStatus === 'running' ? 'Wiping…' : 'Run secure wipe'}
                  </button>
                </div>
              </div>
              {wipeStatus === 'done' && <div className="alert success">Secure wipe completed. Please exit the app.</div>}
              {wipeStatus === 'error' && <div className="alert error">Secure wipe failed: {wipeError}</div>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
