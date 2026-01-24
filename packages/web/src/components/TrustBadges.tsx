import React from 'react';
import { Shield, Lock, Server } from 'lucide-react';

export const TrustBadges: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-3 justify-center items-center">
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
        <Lock size={16} className="text-green-400" />
        <span className="text-green-300 text-xs font-medium">End-to-End Encrypted</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg">
        <Shield size={16} className="text-blue-400" />
        <span className="text-blue-300 text-xs font-medium">No Server Storage</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/40 rounded-lg">
        <Server size={16} className="text-purple-400" />
        <span className="text-purple-300 text-xs font-medium">Relay Fallback Only</span>
      </div>
    </div>
  );
};
