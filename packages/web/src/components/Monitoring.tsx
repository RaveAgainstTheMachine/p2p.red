import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

interface MonitoringStats {
  uptime: number;
  transfersToday: number;
  activeConnections: number;
}

export const Monitoring: React.FC = () => {
  const [stats, setStats] = useState<MonitoringStats>({
    uptime: 0,
    transfersToday: 0,
    activeConnections: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check service health
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setStats({
            uptime: data.uptime || 0,
            transfersToday: 0, // Privacy: no tracking
            activeConnections: 0 // Privacy: no tracking
          });
        }
      } catch (error) {
        // Service health check failed
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(seconds / 60)}m`;
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        title="Service Status"
      >
        <Activity size={20} className="text-white/60" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-green-400" />
          <h3 className="text-sm font-semibold text-white">Service Status</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/60">Status:</span>
          <span className="text-green-400 font-semibold">● Online</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Uptime:</span>
          <span className="text-white">{formatUptime(stats.uptime)}</span>
        </div>
        <div className="text-white/40 text-[10px] mt-2 pt-2 border-t border-white/10">
          Privacy: No user tracking
        </div>
      </div>
    </div>
  );
};
