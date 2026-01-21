import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

interface MonitoringStats {
  uptime: number;
  transfersToday: number;
  activeConnections: number;
}

type ServiceStatus = 'online' | 'offline' | 'degraded' | 'unknown';

interface StatusResponse {
  status: ServiceStatus;
  checkedAt?: string;
  uptimeSeconds?: number;
  services?: Record<string, ServiceStatus>;
}

export const Monitoring: React.FC = () => {
  const statusUrl = import.meta.env.PROD
    ? `${window.location.origin}/api/status`
    : 'http://localhost:3001/api/status';
  const [stats, setStats] = useState<MonitoringStats>({
    uptime: 0,
    transfersToday: 0,
    activeConnections: 0
  });
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>('unknown');
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check service health
    const checkHealth = async () => {
      try {
        const response = await fetch(statusUrl);
        if (response.ok) {
          const data: StatusResponse = await response.json();
          setStats({
            uptime: data.uptimeSeconds || 0,
            transfersToday: 0, // Privacy: no tracking
            activeConnections: 0 // Privacy: no tracking
          });
          setOverallStatus(data.status || 'unknown');
          setServiceStatuses(data.services || {});
          setLastCheckedAt(data.checkedAt || null);
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

  const services = [
    { key: 'web', label: 'Web' },
    { key: 'signal', label: 'Signal' },
    { key: 'api', label: 'API' },
    { key: 'databases', label: 'Databases' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'turn', label: 'TURN' },
    { key: 'secrets', label: 'Secret Management' }
  ];

  const getStatusColor = (status: ServiceStatus) => {
    if (status === 'online') return 'text-green-400';
    if (status === 'degraded') return 'text-yellow-400';
    if (status === 'offline') return 'text-red-400';
    return 'text-white/50';
  };

  const formatStatusLabel = (status: ServiceStatus) => {
    if (status === 'online') return 'Online';
    if (status === 'degraded') return 'Degraded';
    if (status === 'offline') return 'Offline';
    return 'Unknown';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
        title="Service Status"
      >
        <Activity size={20} className="text-white/60" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 z-50 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-lg p-4 shadow-lg">
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
          <span className={`${getStatusColor(overallStatus)} font-semibold`}>
            ● {formatStatusLabel(overallStatus)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/60">Uptime:</span>
          <span className="text-white">{formatUptime(stats.uptime)}</span>
        </div>
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="text-white/50 text-[10px] uppercase tracking-wide mb-2">Systems</div>
          <div className="space-y-1">
            {services.map((service) => {
              const status = serviceStatuses[service.key] || 'unknown';
              return (
                <div key={service.label} className="flex items-center justify-between">
                  <span className="text-white/60">{service.label}</span>
                  <span className={getStatusColor(status)}>
                    ● {formatStatusLabel(status)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {lastCheckedAt && (
          <div className="text-white/40 text-[10px]">
            Last check: {new Date(lastCheckedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};
