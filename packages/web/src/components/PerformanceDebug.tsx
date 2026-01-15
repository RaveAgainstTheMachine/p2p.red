import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '@p2p-file-share/shared';

interface PerformanceDebugProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PerformanceDebug: React.FC<PerformanceDebugProps> = ({ isVisible, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    const updateInterval = setInterval(() => {
      try {
        const report = performanceMonitor.generateReport();
        const parsed = JSON.parse(report);
        
        setLogs(parsed.recentLogs.map((log: any) => 
          `[${new Date(log.timestamp).toISOString().substr(14, 8)}] ${log.event}: ${JSON.stringify(log.data)}`
        ));
        
        setMetrics(parsed.performanceAnalysis);
        setIsMonitoring(true);
      } catch (error) {
        console.error('Failed to get performance report:', error);
        setIsMonitoring(false);
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [isVisible]);

  const downloadReport = () => {
    performanceMonitor.downloadReport();
  };

  const clearLogs = () => {
    // Clear would need to be implemented in performanceMonitor
    console.log('Clear logs functionality to be implemented');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white p-6 rounded-lg max-w-4xl max-h-96 overflow-auto w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔍 Performance Monitor</h2>
          <div className="flex gap-2">
            <button
              onClick={downloadReport}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              📥 Download Report
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
            >
              🗑️ Clear
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">
              {isMonitoring ? '🟢 Monitoring Active' : '🔴 Monitoring Inactive'}
            </span>
          </div>
        </div>

        {metrics && (
          <div className="mb-4 p-3 bg-gray-800 rounded">
            <h3 className="font-semibold mb-2">📊 Performance Analysis</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Avg CPU Lag: <span className="text-yellow-400">{metrics.avgCpuLag}</span></div>
              <div>Avg Receiver Speed: <span className="text-green-400">{metrics.avgReceiverSpeed}</span></div>
              <div>Avg Update Frequency: <span className="text-blue-400">{metrics.avgUpdateFrequency}</span></div>
              <div>Chunks Processed: <span className="text-purple-400">{metrics.totalChunksProcessed}</span></div>
            </div>
            
            {metrics.bottlenecks && metrics.bottlenecks.length > 0 && (
              <div className="mt-3">
                <h4 className="font-semibold text-red-400">🚨 Bottlenecks Detected:</h4>
                <ul className="text-sm text-red-300">
                  {metrics.bottlenecks.map((bottleneck: string, index: number) => (
                    <li key={index}>• {bottleneck}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-800 rounded p-3">
          <h3 className="font-semibold mb-2">📝 Live Logs</h3>
          <div className="font-mono text-xs bg-black rounded p-2 h-48 overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500">No logs available...</div>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-400">
          <p>💡 Tips:</p>
          <ul className="list-disc list-inside">
            <li>High CPU lag indicates receiver is overwhelmed</li>
            <li>Low update frequency suggests React throttling</li>
            <li>Download report for detailed analysis</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
