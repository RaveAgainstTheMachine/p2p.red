/**
 * Metadata API Client
 * Handles communication with the metadata API server for short link generation
 */

import { apiUrl } from '../config/environments';

export const API_BASE_URL = `${apiUrl.replace(/\/$/, '')}/api`;

export interface TransferMetadata {
  peerId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  pin?: string;
  hasPin?: boolean;
  pinType?: 'pin' | 'passphrase' | null;
  expiresAt?: string;
}

export interface ShortLinkResponse {
  key: string;
  expiresAt: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithChallenge = async (url: string, options: RequestInit): Promise<Response> => {
  let response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const isAnubisHeader = response.headers.get('x-anubis-status') === 'challenge';
  
  // If we get HTML when we expect JSON (metadata API), it's likely a challenge
  const isLikelyChallenge = isAnubisHeader || (contentType.includes('text/html') && !url.includes('?html=true'));

  if (isLikelyChallenge) {
    console.warn('🛡️ Bot challenge detected for:', url, 'Header:', isAnubisHeader, 'HTML:', contentType.includes('text/html'));
    
    // Use the target URL itself for the challenge - Anubis will intercept the GET request and serve the challenge HTML
    const challengeUrl = url;
    
    window.dispatchEvent(
      new CustomEvent('anubis-challenge', {
        detail: { active: true, url: challengeUrl }
      })
    );

    // Wait for challenge to be solved (cookie set)
    for (let attempt = 0; attempt < 15; attempt += 1) {
      console.log(`⏳ Waiting for challenge solution (attempt ${attempt + 1})...`);
      await delay(2000); 
      
      const retryResponse = await fetch(url, options);
      const retryContentType = retryResponse.headers.get('content-type') || '';
      const retryAnubisHeader = retryResponse.headers.get('x-anubis-status') === 'challenge';
      const stillChallenged = retryAnubisHeader || (retryContentType.includes('text/html') && !url.includes('?html=true'));
      
      if (!stillChallenged) {
        console.log('✅ Challenge cleared!');
        window.dispatchEvent(
          new CustomEvent('anubis-challenge', {
            detail: { active: false }
          })
        );
        return retryResponse;
      }
    }
    
    // If we reach here, we failed to clear the challenge
    window.dispatchEvent(
      new CustomEvent('anubis-challenge', {
        detail: { active: false }
      })
    );
    throw new Error('Bot challenge timed out. Please refresh and try again.');
  }

  return response;
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
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      } else {
        const text = await response.text();
        console.error('📡 Non-JSON error response from metadata API:', text);
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Server returned non-JSON response.`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data: ShortLinkResponse = await response.json();
      console.log(`✅ Short link created: ${data.key}, expires: ${data.expiresAt}`);
      return data.key;
    } else {
      const text = await response.text();
      console.error('📡 Unexpected non-JSON success response:', text);
      throw new Error('Server returned invalid response format (not JSON)');
    }
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
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let error: any = {};
      
      if (contentType && contentType.includes('application/json')) {
        error = await response.json();
      } else {
        const text = await response.text();
        console.error('📡 Non-JSON error response from getMetadata:', text);
        error = { error: `HTTP ${response.status}: ${response.statusText}`, message: text };
      }
      
      if (response.status === 404) {
        throw new Error('Link not found or has expired');
      }
      if (response.status === 410) {
        throw new Error('Link has expired');
      }
      if (response.status === 401 && error.requiresPin) {
        const err: any = new Error('PIN_REQUIRED');
        err.requiresPin = true;
        err.pinType = error.pinType || null;
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

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const metadata: TransferMetadata = await response.json();
      console.log(`📥 Retrieved metadata for key: ${key}`, metadata);
      return metadata;
    } else {
      const text = await response.text();
      console.error('📡 Unexpected non-JSON success response from getMetadata:', text);
      throw new Error('Server returned invalid response format (not JSON)');
    }
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
