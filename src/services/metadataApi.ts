/**
 * Metadata API Client
 * Handles communication with the metadata API server for short link generation
 */

const apiEnvBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_BASE_URL = apiEnvBase
  ? `${apiEnvBase}/api`
  : import.meta.env.PROD
    ? 'https://p2p.red/api'
    : 'http://localhost:3001/api';

export interface TransferMetadata {
  peerId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  pin?: string;
  hasPin?: boolean;
  expiresAt?: string;
}

export interface ShortLinkResponse {
  key: string;
  expiresAt: string;
}

const isJsonResponse = (response: Response) =>
  response.headers.get('content-type')?.includes('application/json');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithChallenge = async (url: string, options: RequestInit, challengeUrl: string) => {
  let response = await fetch(url, options);

  if (isJsonResponse(response)) {
    return response;
  }

  window.dispatchEvent(
    new CustomEvent('anubis-challenge', {
      detail: { active: true, url: challengeUrl }
    })
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(500);
    response = await fetch(url, options);
    if (isJsonResponse(response)) {
      window.dispatchEvent(
        new CustomEvent('anubis-challenge', {
          detail: { active: false }
        })
      );
      return response;
    }
  }

  window.dispatchEvent(
    new CustomEvent('anubis-challenge', {
      detail: { active: false }
    })
  );
  throw new Error('Anubis challenge required. Complete it, then retry.');
};

/**
 * Store transfer metadata and get short link key
 */
export async function createShortLink(metadata: TransferMetadata, pin?: string): Promise<string> {
  try {
    const payload = { ...metadata };
    if (pin) {
      payload.pin = pin;
    }
    
    console.log('📡 createShortLink payload:', { 
      ...payload, 
      pin: payload.pin ? '****' : undefined,
      hasPin: !!payload.pin 
    });
    
    const response = await fetchWithChallenge(`${API_BASE_URL}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    }, `${API_BASE_URL}/metadata`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ShortLinkResponse = await response.json();
    console.log(`✅ Short link created: ${data.key}, expires: ${data.expiresAt}`);
    return data.key;
  } catch (error) {
    console.error('Failed to create short link:', error);
    throw new Error(`Failed to create short link: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve transfer metadata using short link key
 */
export async function getMetadata(key: string, pin?: string): Promise<TransferMetadata> {
  try {
    if (!key || key.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(key)) {
      throw new Error('Invalid short link key format');
    }

    const url = `${API_BASE_URL}/metadata/${key}`;
    const response = await fetchWithChallenge(url, {
      headers: pin ? { 'x-p2p-pin': pin } : undefined,
      credentials: 'include',
    }, url);

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 404) {
        throw new Error('Link not found or has expired');
      }
      if (response.status === 410) {
        throw new Error('Link has expired');
      }
      if (response.status === 401 && error.requiresPin) {
        const err: any = new Error('PIN_REQUIRED');
        err.requiresPin = true;
        throw err;
      }
      if (response.status === 403) {
        const err: any = new Error(error.message || 'Invalid PIN');
        err.remainingAttempts = error.remainingAttempts;
        throw err;
      }
      if (response.status === 429) {
        throw new Error(error.message || 'Too many PIN attempts. Please try again later.');
      }
      throw new Error(error.error || error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const metadata: TransferMetadata = await response.json();
    console.log(`📥 Retrieved metadata for key: ${key}`, metadata);
    return metadata;
  } catch (error) {
    console.error('Failed to retrieve metadata:', error);
    // Re-throw the original error to preserve requiresPin and remainingAttempts properties
    throw error;
  }
}

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}
