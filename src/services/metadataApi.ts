/**
 * Metadata API Client
 * Handles communication with the metadata API server for short link generation
 */

const API_BASE_URL = import.meta.env.PROD
  ? 'https://p2p.red/api'
  : 'http://localhost:3001/api';

export interface TransferMetadata {
  peerId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface ShortLinkResponse {
  key: string;
  expiresAt: string;
}

/**
 * Store transfer metadata and get short link key
 */
export async function createShortLink(metadata: TransferMetadata): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

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
export async function getMetadata(key: string): Promise<TransferMetadata> {
  try {
    if (!key || key.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(key)) {
      throw new Error('Invalid short link key format');
    }

    const response = await fetch(`${API_BASE_URL}/metadata/${key}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Link not found or has expired');
      }
      if (response.status === 410) {
        throw new Error('Link has expired');
      }
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const metadata: TransferMetadata = await response.json();
    console.log(`📥 Retrieved metadata for key: ${key}`, metadata);
    return metadata;
  } catch (error) {
    console.error('Failed to retrieve metadata:', error);
    throw new Error(`Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
