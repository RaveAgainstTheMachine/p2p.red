import { describe, expect, it, vi } from 'vitest';
import { performanceMonitor } from './performanceMonitor';

describe('performanceMonitor', () => {
  it('generates a report after logging', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    performanceMonitor.startMonitoring();
    performanceMonitor.onChunkReceived(1, 1024, 2048);
    performanceMonitor.onProgressUpdate();

    const report = performanceMonitor.generateReport();
    const parsed = JSON.parse(report) as { summary: { totalLogs: number }; recentLogs: unknown[] };

    expect(parsed.summary.totalLogs).toBeGreaterThan(0);
    expect(parsed.recentLogs.length).toBeGreaterThan(0);

    logSpy.mockRestore();
  });
});
