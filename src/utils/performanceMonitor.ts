import { debugLog } from '../utils/logger';
interface TransferMetrics {
  senderSpeed: number;
  receiverSpeed: number;
  chunkSize: number;
  chunksPerSecond: number;
  uiUpdateFrequency: number;
  memoryUsage: number;
  cpuLag: number;
  networkLatency: number;
  bufferHealth: number;
}

interface PerformanceLog {
  timestamp: number;
  event: string;
  data: unknown;
  metrics?: TransferMetrics;
}

class PerformanceMonitor {
  private logs: PerformanceLog[] = [];
  private startTime: number = 0;
  private lastChunkTime: number = 0;
  private chunkCount: number = 0;
  private lastProgressUpdate: number = 0;
  private progressUpdateCount: number = 0;

  startMonitoring() {
    this.startTime = Date.now();
    this.log('MONITOR_START', 'Performance monitoring initialized');
  }

  log(event: string, data: unknown, metrics?: TransferMetrics) {
    const logEntry: PerformanceLog = {
      timestamp: Date.now(),
      event,
      data,
      metrics
    };
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Console log with formatting
    debugLog(`🔍 [${event}]`, data, metrics ? `| Metrics: ${JSON.stringify(metrics)}` : '');
  }

  onChunkReceived(chunkIndex: number, chunkSize: number, bytesTransferred: number) {
    this.chunkCount++;
    const now = Date.now();
    const timeSinceLastChunk = now - this.lastChunkTime;
    this.lastChunkTime = now;

    const chunksPerSecond = timeSinceLastChunk > 0 ? 1000 / timeSinceLastChunk : 0;
    const elapsedSeconds = (now - this.startTime) / 1000;
    const currentSpeed = elapsedSeconds > 0 ? bytesTransferred / elapsedSeconds : 0;

    const metrics: TransferMetrics = {
      senderSpeed: 0, // Will be updated from sender
      receiverSpeed: currentSpeed,
      chunkSize,
      chunksPerSecond,
      uiUpdateFrequency: 0, // Will be tracked separately
      memoryUsage: this.getMemoryUsage(),
      cpuLag: timeSinceLastChunk,
      networkLatency: 0, // Will be measured separately
      bufferHealth: this.getBufferHealth()
    };

    this.log('CHUNK_RECEIVED', {
      chunkIndex,
      chunkSize,
      bytesTransferred,
      timeSinceLastChunk
    }, metrics);
  }

  onProgressUpdate() {
    this.progressUpdateCount++;
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastProgressUpdate;
    this.lastProgressUpdate = now;

    const updateFrequency = timeSinceLastUpdate > 0 ? 1000 / timeSinceLastUpdate : 0;

    this.log('PROGRESS_UPDATE', {
      updateCount: this.progressUpdateCount,
      timeSinceLastUpdate
    }, {
      senderSpeed: 0,
      receiverSpeed: 0,
      chunkSize: 0,
      chunksPerSecond: 0,
      uiUpdateFrequency: updateFrequency,
      memoryUsage: this.getMemoryUsage(),
      cpuLag: 0,
      networkLatency: 0,
      bufferHealth: 0
    });
  }

  onSenderSpeedReport(speed: number) {
    this.log('SENDER_SPEED', { speed });
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return performance.memory?.usedJSHeapSize ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0; // MB
    }
    return 0;
  }

  private getBufferHealth(): number {
    // This would need to be implemented based on WebRTC buffer
    return 100; // Placeholder
  }

  generateReport(): string {
    const report = {
      summary: {
        totalLogs: this.logs.length,
        monitoringDuration: Date.now() - this.startTime,
        totalChunks: this.chunkCount,
        progressUpdates: this.progressUpdateCount
      },
      recentLogs: this.logs.slice(-20), // Last 20 events
      performanceAnalysis: this.analyzePerformance()
    };

    return JSON.stringify(report, null, 2);
  }

  private analyzePerformance() {
    const chunkLogs = this.logs.filter(log => log.event === 'CHUNK_RECEIVED');
    const progressLogs = this.logs.filter(log => log.event === 'PROGRESS_UPDATE');

    if (chunkLogs.length === 0) return { error: 'No chunk data available' };

    const avgCpuLag = chunkLogs.reduce((sum, log) => sum + (log.metrics?.cpuLag || 0), 0) / chunkLogs.length;
    const avgReceiverSpeed = chunkLogs.reduce((sum, log) => sum + (log.metrics?.receiverSpeed || 0), 0) / chunkLogs.length;
    const avgUpdateFrequency = progressLogs.length > 0 ? 
      progressLogs.reduce((sum, log) => sum + (log.metrics?.uiUpdateFrequency || 0), 0) / progressLogs.length : 0;

    return {
      avgCpuLag: avgCpuLag.toFixed(2) + 'ms',
      avgReceiverSpeed: (avgReceiverSpeed / 1024 / 1024).toFixed(2) + 'MB/s',
      avgUpdateFrequency: avgUpdateFrequency.toFixed(2) + ' updates/sec',
      totalChunksProcessed: chunkLogs.length,
      bottlenecks: this.identifyBottlenecks(avgCpuLag, avgReceiverSpeed, avgUpdateFrequency)
    };
  }

  private identifyBottlenecks(cpuLag: number, receiverSpeed: number, updateFreq: number): string[] {
    const bottlenecks: string[] = [];

    if (cpuLag > 100) bottlenecks.push('High CPU lag - receiver overwhelmed');
    if (receiverSpeed < 10 * 1024 * 1024) bottlenecks.push('Low receiver speed - processing bottleneck');
    if (updateFreq < 0.1) bottlenecks.push('Low UI update frequency - React throttling');
    if (this.getMemoryUsage() > 500) bottlenecks.push('High memory usage - possible memory leak');

    return bottlenecks;
  }

  downloadReport() {
    const report = this.generateReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const performanceMonitor = new PerformanceMonitor();
