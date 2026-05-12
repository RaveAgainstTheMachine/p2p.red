import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';

afterEach(() => {
  cleanup();
});

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (!globalThis.indexedDB) {
  Object.defineProperty(globalThis, 'indexedDB', {
    value: indexedDB,
    configurable: true,
  });
}

if (!globalThis.IDBKeyRange) {
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: IDBKeyRange,
    configurable: true,
  });
}

if (typeof File !== 'undefined') {
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function arrayBuffer() {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  if (!File.prototype.text) {
    File.prototype.text = async function text() {
      const buffer = await this.arrayBuffer();
      return new TextDecoder().decode(buffer);
    };
  }
}
