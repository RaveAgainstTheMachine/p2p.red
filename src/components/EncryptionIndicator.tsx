import { Shield, Lock, Check, Zap } from 'lucide-react';

interface EncryptionIndicatorProps {
  isEncrypted: boolean;
  isVisible: boolean;
}

export function EncryptionIndicator({ isEncrypted, isVisible }: EncryptionIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-center mb-6">
      <div className={`
        relative flex items-center gap-3 px-6 py-3 rounded-2xl
        backdrop-blur-xl border transition-all duration-500
        ${isEncrypted 
          ? 'bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20' 
          : 'bg-white/5 border-white/10'
        }
        animate-in fade-in slide-in-from-top-4
      `}>
        {/* Animated gradient background for encrypted state */}
        {isEncrypted && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 animate-pulse"></div>
        )}
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative">
            {isEncrypted ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-cyan-400 rounded-full blur-md opacity-50 animate-pulse"></div>
                <Shield className="relative w-6 h-6 text-purple-300" />
                <div className="absolute -top-1 -right-1 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-0.5 shadow-lg">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              </>
            ) : (
              <>
                <Lock className="w-6 h-6 text-white/40 animate-pulse" />
              </>
            )}
          </div>
          
          <div className="flex flex-col">
            <span className={`text-sm font-semibold ${isEncrypted ? 'text-white' : 'text-white/60'}`}>
              {isEncrypted ? 'End-to-End Encrypted' : 'Establishing Encryption...'}
            </span>
            <span className={`text-xs ${isEncrypted ? 'text-purple-200/80' : 'text-white/40'}`}>
              {isEncrypted ? 'Secure P2P connection active' : 'Connecting...'}
            </span>
          </div>
          
          {isEncrypted && (
            <div className="ml-2 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400 animate-pulse" fill="currentColor" />
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
