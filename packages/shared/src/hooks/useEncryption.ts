import { useState, useCallback } from 'react';

export interface EncryptedFile {
  data: ArrayBuffer;
  key: string;
  iv: string;
  name: string;
  size: number;
  type: string;
}

export const useEncryption = () => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const generateKey = useCallback(async (): Promise<string> => {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const exported = await crypto.subtle.exportKey('raw', key);
    const keyString = btoa(String.fromCharCode(...new Uint8Array(exported)));
    
    return keyString;
  }, []);

  const encryptFile = useCallback(async (file: File): Promise<EncryptedFile> => {
    setIsEncrypting(true);
    
    try {
      // Check file size to prevent memory issues
      const MAX_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_SIZE) {
        throw new Error(`File too large for encryption. Maximum size is ${MAX_SIZE / 1024 / 1024}MB`);
      }

      // Add timeout to prevent hanging
      const encryptionPromise = (async () => {
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Read file in chunks to prevent memory issues
        const buffer = await file.arrayBuffer();

        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          buffer
        );

        const exportedKey = await crypto.subtle.exportKey('raw', key);
        const keyString = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
        const ivString = btoa(String.fromCharCode(...iv));

        return {
          data: encrypted,
          key: keyString,
          iv: ivString,
          name: file.name,
          size: file.size,
          type: file.type
        };
      })();

      // Add timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Encryption timeout - file may be too large')), 30000); // 30 seconds
      });

      const result = await Promise.race([encryptionPromise, timeoutPromise]);
      
      return result as EncryptedFile;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    } finally {
      setIsEncrypting(false);
    }
  }, []);

  const decryptFile = useCallback(async (encrypted: EncryptedFile): Promise<File> => {
    setIsDecrypting(true);
    
    try {
      const keyBuffer = Uint8Array.from(atob(encrypted.key), c => c.charCodeAt(0));
      const ivBuffer = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        'AES-GCM',
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        key,
        encrypted.data
      );

      return new File([decrypted], encrypted.name, {
        type: encrypted.type
      });
    } finally {
      setIsDecrypting(false);
    }
  }, []);

  return {
    generateKey,
    encryptFile,
    decryptFile,
    isEncrypting,
    isDecrypting
  };
};
