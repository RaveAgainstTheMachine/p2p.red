import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

type ServiceStatus = 'online' | 'offline' | 'degraded' | 'unknown';
type DisplayStatus = 'healthy' | 'degraded' | 'offline';

interface StatusResponse {
  status: ServiceStatus;
  checkedAt?: string;
  uptimeSeconds?: number;
  services?: Record<string, ServiceStatus>;
}

type MonitoringPlacement = 'fixed' | 'footer';

interface MonitoringProps {
  placement?: MonitoringPlacement;
}

export const Monitoring: React.FC<MonitoringProps> = ({ placement = 'fixed' }) => {
  const statusUrl = import.meta.env.PROD
    ? `${window.location.origin}/api/status`
    : '/api/status';
  const [overallStatus, setOverallStatus] = useState<DisplayStatus>('degraded');
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({});
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const normalizeStatus = (status: ServiceStatus): DisplayStatus => {
    if (status === 'online') return 'healthy';
    if (status === 'offline') return 'offline';
    return 'degraded';
  };

  const deriveOverallStatus = (services: Record<string, ServiceStatus>): DisplayStatus => {
    const values = Object.values(services);
    if (values.length === 0) return 'degraded';
    if (values.some((value) => value === 'offline')) return 'offline';
    if (values.some((value) => value !== 'online')) return 'degraded';
    return 'healthy';
  };

  useEffect(() => {
    // Check service health
    const checkHealth = async () => {
      try {
        const response = await fetch(statusUrl);
        if (response.ok) {
          const data: StatusResponse = await response.json();
          const services = data.services || {};
          const overall = Object.keys(services).length > 0
            ? deriveOverallStatus(services)
            : normalizeStatus(data.status || 'unknown');
          setOverallStatus(overall);
          setServiceStatuses(services);
          setLastCheckedAt(data.checkedAt || null);
        }
      } catch (error) {
        console.warn('Service health check failed', error);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [statusUrl]);

  const services = [
    { key: 'web', label: 'Web' },
    { key: 'signal', label: 'Signal' },
    { key: 'api', label: 'API' },
    { key: 'databases', label: 'Databases' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'turn', label: 'TURN' },
    { key: 'secrets', label: 'Vault' }
  ];

  const getStatusColor = (status: DisplayStatus) => {
    if (status === 'healthy') return 'text-green-400';
    if (status === 'degraded') return 'text-yellow-400';
    if (status === 'offline') return 'text-red-400';
    return 'text-white/50';
  };

  const formatStatusLabel = (status: DisplayStatus) => {
    if (status === 'healthy') return 'Healthy';
    if (status === 'degraded') return 'Degraded';
    if (status === 'offline') return 'Offline';
    return 'Degraded';
  };

  return (
    <div className={placement === 'footer' ? 'relative' : ''}>
      <button
        onClick={() => setIsVisible((prev) => !prev)}
        className={
          placement === 'footer'
            ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 shadow-lg shadow-black/20 backdrop-blur transition-colors hover:bg-white/10 hover:text-white'
            : 'fixed bottom-1 right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20'
        }
        title="Service Status"
      >
        <Activity
          size={placement === 'footer' ? 18 : 20}
          className={`${getStatusColor(overallStatus)} ${overallStatus === 'healthy' ? 'animate-pulse' : ''} transition-colors duration-500`}
        />
      </button>
      {isVisible && (
        <div
          className={
            placement === 'footer'
              ? 'fixed sm:absolute bottom-20 sm:bottom-full left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mb-2 z-[200] w-[90vw] sm:w-64 bg-black/95 border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-md'
              : 'fixed bottom-1 right-4 z-[200] bg-black/95 border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-md'
          }
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className={getStatusColor(overallStatus)} />
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
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="space-y-1">
                {services.map((service) => {
                  const rawStatus = serviceStatuses[service.key] || 'unknown';
                  const status = normalizeStatus(rawStatus);
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
      )}
    </div>
  );
};
