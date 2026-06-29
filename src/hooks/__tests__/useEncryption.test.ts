import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEncryption } from '../useEncryption';

describe('useEncryption', () => {
  it('encrypts and decrypts a file round-trip', async () => {
    const { result } = renderHook(() => useEncryption());
    const buffer = new TextEncoder().encode('hello').buffer;
    const file = new File([buffer], 'hello.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => buffer.slice(0),
    });

    const encrypted = await act(async () => {
      return await result.current.encryptFile(file);
    });

    const decrypted = await act(async () => {
      return await result.current.decryptFile(encrypted);
    });

    const decryptedBuffer = await decrypted.arrayBuffer();
    const text = new TextDecoder().decode(decryptedBuffer);
    expect(text).toBe('hello');
    expect(decrypted.name).toBe('hello.txt');
  });

  it('generates a key', async () => {
    const { result } = renderHook(() => useEncryption());
    const key = await act(async () => result.current.generateKey());
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});
