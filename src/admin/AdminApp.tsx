import { useCallback, useEffect, useMemo, useState } from 'react';

const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const adminBaseEnv = (import.meta.env.VITE_ADMIN_API_URL || '').replace(/\/$/, '');
const apiBase = adminBaseEnv
  || (import.meta.env.PROD ? (runtimeOrigin || 'https://p2p.red') : 'http://localhost:3001');
const ADMIN_API_BASE = `${apiBase}/api/admin`;

type AdminStatusResponse = {
  status: 'online' | 'offline' | 'degraded';
  checkedAt: string;
  uptimeSeconds: number;
  services: Record<string, string>;
  details?: {
    databases?: Record<string, string>;
  };
  admin?: {
    telemetryIngestEnabled: boolean;
    requestLoggingEnabled: boolean;
    telemetryRetentionDays: number;
    telemetryDailyLimit: number;
  };
};

type TelemetrySummary = {
  range: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    events: number;
  };
  daily: Array<{ date: string; count: number }>;
  breakdown: Record<string, Record<string, number>>;
  telemetry: {
    retentionDays: number;
    dailyLimit: number;
    ingestEnabled: boolean;
  };
};

type TelemetryEvent = {
  eventType?: string;
  role?: string;
  connectionType?: string;
  stage?: string;
  errorCode?: string;
  errorMessage?: string;
  browser?: string;
  os?: string;
  timestamp?: string;
  receivedAt?: string;
};

const fetchJson = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error || response.statusText || 'Request failed');
    (err as any).status = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

const formatDateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const statusStyles: Record<string, string> = {
  online: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/40',
  degraded: 'bg-amber-400/20 text-amber-200 border-amber-400/40',
  offline: 'bg-rose-400/20 text-rose-200 border-rose-400/40',
};

export function AdminApp() {
  const [sessionReady, setSessionReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  useEffect(() => {
    document.title = 'p2p.red Admin Dashboard';
  }, []);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const [statusData, summaryData, eventsData] = await Promise.all([
        fetchJson<AdminStatusResponse>(`${ADMIN_API_BASE}/status`),
        fetchJson<TelemetrySummary>(`${ADMIN_API_BASE}/telemetry/summary?range=7d`),
        fetchJson<{ events: TelemetryEvent[] }>(`${ADMIN_API_BASE}/telemetry/events?limit=80`)
      ]);
      setStatus(statusData);
      setSummary(summaryData);
      setEvents(eventsData.events || []);
      setSessionReady(true);
    } catch (error) {
      const statusCode = (error as any).status;
      if (statusCode === 401) {
        setSessionReady(false);
      } else {
        setAuthError((error as Error).message || 'Unable to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      await fetchJson(`${ADMIN_API_BASE}/login`, {
        method: 'POST',
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password
        })
      });
      await hydrate();
    } catch (error) {
      setAuthError((error as Error).message || 'Login failed.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetchJson(`${ADMIN_API_BASE}/logout`, { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionReady(false);
    setStatus(null);
    setSummary(null);
    setEvents([]);
    setLoading(false);
  };

  const handleToggle = async (endpoint: 'telemetry' | 'logging', enabled: boolean) => {
    setLoading(true);
    try {
      await fetchJson(`${ADMIN_API_BASE}/${endpoint}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
      await hydrate();
    } catch (error) {
      setAuthError((error as Error).message || 'Toggle failed.');
    } finally {
      setLoading(false);
    }
  };

  const chartMax = useMemo(() => {
    const values = summary?.daily.map((item) => item.count) || [];
    return Math.max(1, ...values);
  }, [summary]);

  if (!sessionReady) {
    return (
      <div className="admin-root min-h-screen bg-[radial-gradient(circle_at_top,#1f2937,#0f172a_45%,#07060f_100%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            dash.p2p.red
          </div>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Operations control tower for <span className="text-emerald-300">p2p.red</span>.
              </h1>
              <p className="mt-4 text-lg text-slate-300">
                Secure access via OpenBao userpass. Live telemetry, system health, and guarded ops toggles in one place.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {['Telemetry volume', 'Transfer errors', 'Blue/green status', 'Secrets health'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-white/50">Signal</div>
                    <div className="mt-2 text-lg text-white/80">{item}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40">
              <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">Admin Login</h2>
              <form className="mt-6 space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/50">Username</label>
                  <input
                    value={loginForm.username}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white/90 outline-none focus:border-emerald-400/60"
                    placeholder="bao-admin"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-white/50">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white/90 outline-none focus:border-emerald-400/60"
                    placeholder="••••••••"
                  />
                </div>
                {authError && (
                  <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {authError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-emerald-400/90 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Authenticating…' : 'Enter Dashboard'}
                </button>
              </form>
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-white/40">
                Requires OpenBao admin policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-root min-h-screen bg-[radial-gradient(circle_at_top,#172554,#0b1022_50%,#05030a_100%)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">dash.p2p.red</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Admin Telemetry & Ops</h1>
            <p className="mt-2 text-sm text-slate-300">Live status, telemetry signals, and guarded runtime controls.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => hydrate()}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 hover:bg-white/20"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-rose-200 hover:bg-rose-500/20"
            >
              Logout
            </button>
          </div>
        </div>

        {authError && (
          <div className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {authError}
          </div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">System Status</h2>
              {status && (
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em] ${statusStyles[status.status] || 'border-white/20 text-white/70'}`}>
                  {status.status}
                </span>
              )}
            </div>
            {status ? (
              <div className="mt-6 grid gap-4">
                <div className="flex flex-wrap gap-4 text-sm text-white/70">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Uptime</p>
                    <p className="mt-1 text-lg text-white/90">{formatUptime(status.uptimeSeconds)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Checked</p>
                    <p className="mt-1 text-lg text-white/90">{new Date(status.checkedAt).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(status.services).map(([service, state]) => (
                    <div key={service} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <span className="text-sm uppercase tracking-[0.2em] text-white/60">{service}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em] ${statusStyles[state] || 'border-white/20 text-white/70'}`}>
                        {state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/60">Loading status…</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
            <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">Ops Controls</h2>
            <div className="mt-6 space-y-4 text-sm text-white/80">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Telemetry ingest</p>
                  <p className="mt-1 text-base text-white/90">{summary?.telemetry.ingestEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <button
                  onClick={() => handleToggle('telemetry', !(summary?.telemetry.ingestEnabled ?? true))}
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100"
                >
                  Toggle
                </button>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/40">Request logging</p>
                  <p className="mt-1 text-base text-white/90">{status?.admin?.requestLoggingEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <button
                  onClick={() => handleToggle('logging', !(status?.admin?.requestLoggingEnabled ?? true))}
                  className="rounded-full border border-sky-400/30 bg-sky-400/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-100"
                >
                  Toggle
                </button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/50">
                Retention {summary?.telemetry.retentionDays ?? status?.admin?.telemetryRetentionDays} days • Daily cap {summary?.telemetry.dailyLimit ?? status?.admin?.telemetryDailyLimit}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">Telemetry Volume (7d)</h2>
              <div className="text-xs uppercase tracking-[0.3em] text-white/40">{summary?.totals.events ?? 0} events</div>
            </div>
            <div className="mt-6 flex items-end gap-3">
              {(summary?.daily || []).map((item) => (
                <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="h-28 w-full rounded-2xl border border-white/10 bg-black/40">
                    <div
                      className="h-full rounded-2xl bg-gradient-to-t from-emerald-400/80 to-emerald-200/20"
                      style={{ height: `${Math.max(10, (item.count / chartMax) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">{formatDateLabel(item.date)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
            <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">Event Breakdown</h2>
            <div className="mt-6 space-y-4">
              {['eventType', 'role', 'connectionType', 'stage'].map((key) => {
                const entries = Object.entries(summary?.breakdown?.[key] || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">{key}</p>
                    <div className="mt-2 space-y-1 text-sm text-white/80">
                      {entries.length ? entries.map(([label, count]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-white/60">{count}</span>
                        </div>
                      )) : (
                        <span className="text-white/40">No data</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm uppercase tracking-[0.4em] text-white/50">Recent Telemetry Events</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">Showing {events.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {events.length === 0 && (
              <p className="text-sm text-white/60">No telemetry events available.</p>
            )}
            {events.map((event, index) => (
              <div key={`${event.timestamp || event.receivedAt}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">{event.eventType || 'event'}</p>
                    <p className="mt-1 text-sm text-white/80">{event.errorMessage || '—'}</p>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.3em] text-white/40">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : event.receivedAt ? new Date(event.receivedAt).toLocaleString() : ''}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
                  {event.role && <span className="rounded-full border border-white/10 px-2 py-1">{event.role}</span>}
                  {event.connectionType && <span className="rounded-full border border-white/10 px-2 py-1">{event.connectionType}</span>}
                  {event.stage && <span className="rounded-full border border-white/10 px-2 py-1">{event.stage}</span>}
                  {event.errorCode && <span className="rounded-full border border-white/10 px-2 py-1">{event.errorCode}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
