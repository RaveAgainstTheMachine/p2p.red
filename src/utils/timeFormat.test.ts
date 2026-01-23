import { describe, expect, it, vi } from 'vitest';
import { formatExpirationTime, formatRelativeTime } from './timeFormat';

describe('timeFormat utilities', () => {
  it('formats expiration time in minutes', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);
    const expiresAt = new Date('2024-01-01T00:02:00Z').toISOString();
    expect(formatExpirationTime(expiresAt)).toContain('Expires in');
    vi.useRealTimers();
  });

  it('handles expired times', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:10:00Z');
    vi.setSystemTime(now);
    const expiresAt = new Date('2024-01-01T00:00:00Z').toISOString();
    expect(formatExpirationTime(expiresAt)).toBe('Expired');
    vi.useRealTimers();
  });

  it('formats relative future and past times', () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(now);
    const future = new Date('2024-01-01T02:00:00Z').toISOString();
    const past = new Date('2023-12-31T22:00:00Z').toISOString();
    expect(formatRelativeTime(future)).toContain('in 2 hour');
    expect(formatRelativeTime(past)).toContain('2 hour');
    vi.useRealTimers();
  });
});
