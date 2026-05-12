type TelemetryEvent = {
  eventType: string;
  role?: string;
  sessionId?: string;
  buildVersion?: string;
  buildVariant?: string;
  errorCode?: string;
  errorMessage?: string;
  connectionType?: string;
  stage?: string;
  browser?: string;
  os?: string;
  timestamp?: string;
};

const getApiBaseUrl = (): string => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const metaUrl = metaEnv?.VITE_API_URL;
  if (metaUrl) {
    return metaUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

const getBuildInfo = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  return {
    buildVersion: metaEnv?.VITE_BUILD_VERSION,
    buildVariant: metaEnv?.VITE_BUILD_VARIANT
  };
};

const getSessionId = () => {
  if (typeof window === 'undefined') return undefined;
  const key = 'p2p_telemetry_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

const detectBrowser = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
};

const detectOs = () => {
  if (typeof navigator === 'undefined') return 'unknown';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || '';
  if (/Win/i.test(platform)) return 'Windows';
  if (/Mac/i.test(platform)) return 'macOS';
  if (/Linux/i.test(platform)) return 'Linux';
  if (/Android/i.test(platform)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(platform)) return 'iOS';
  return platform || 'Other';
};

export const sendTelemetry = async (event: TelemetryEvent) => {
  try {
    const baseUrl = getApiBaseUrl();
    const { buildVersion, buildVariant } = getBuildInfo();
    const payload: TelemetryEvent = {
      ...event,
      sessionId: event.sessionId || getSessionId(),
      buildVersion: event.buildVersion || buildVersion,
      buildVariant: event.buildVariant || buildVariant,
      browser: event.browser || detectBrowser(),
      os: event.os || detectOs(),
      timestamp: event.timestamp || new Date().toISOString()
    };

    await fetch(`${baseUrl}/api/telemetry/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'omit',
      body: JSON.stringify(payload)
    });
  } catch {
    // best-effort only
  }
};

export type { TelemetryEvent };
