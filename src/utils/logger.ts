/**
 * Centralised Logger
 * Only outputs when localStorage p2p_debug_transfer=1 is set
 */

export const isDebugEnabled = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('p2p_debug_transfer') === '1';
  } catch {
    return false;
  }
};

export const debugLog = (...args: unknown[]): void => {
  if (!isDebugEnabled()) return;
  console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
  if (!isDebugEnabled()) return;
  console.warn(...args);
};

export const debugError = (...args: unknown[]): void => {
  if (!isDebugEnabled()) return;
  console.error(...args);
};
