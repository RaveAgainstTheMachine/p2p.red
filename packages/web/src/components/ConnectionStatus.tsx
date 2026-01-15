import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'transferring';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  speed?: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  status, 
  speed = 0 
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/30',
          label: 'Disconnected'
        };
      case 'connecting':
        return {
          icon: AlertCircle,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20',
          borderColor: 'border-yellow-500/30',
          label: 'Connecting...'
        };
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/30',
          label: 'Connected'
        };
      case 'transferring':
        return {
          icon: Wifi,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/30',
          label: 'Transferring'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/30',
          label: 'Connection Error'
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/30',
          label: 'Unknown'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className={`
      inline-flex items-center gap-3 px-4 py-2 rounded-full border
      ${config.bgColor} ${config.borderColor}
      transition-all duration-300
    `}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Icon 
          size={16} 
          className={`${config.color} ${status === 'connecting' ? 'animate-pulse' : ''}`}
        />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
      
      {speed > 0 && status === 'transferring' && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <span className="text-white/60 text-sm">
            {formatSpeed(speed)}
          </span>
        </div>
      )}
    </div>
  );
};
