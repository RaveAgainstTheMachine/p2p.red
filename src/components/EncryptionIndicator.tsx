import { Shield, Lock, Check, Zap } from 'lucide-react';

interface EncryptionIndicatorProps {
  isEncrypted: boolean;
  isVisible: boolean;
}

export function EncryptionIndicator({ isEncrypted, isVisible }: EncryptionIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-center mb-8">
      <div className={`
        relative flex items-center gap-4 px-6 py-3.5 rounded-full
        backdrop-blur-2xl border transition-all duration-700 ease-out
        ${isEncrypted 
          ? 'bg-red-950/20 border-red-500/30 shadow-[0_0_25px_-5px_rgba(239,68,68,0.2)]' 
          : 'bg-white/5 border-white/10 shadow-none'
        }
        animate-in fade-in slide-in-from-top-6
      `}>
        {/* Subtle red ambient glow for encrypted state */}
        {isEncrypted && (
          <div className="absolute inset-0 rounded-full bg-red-500/5 animate-pulse-slow"></div>
        )}
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            {isEncrypted ? (
              <div className="relative group">
                {/* Layered glow effects */}
                <div className="absolute inset-0 bg-red-500/40 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="absolute inset-0 bg-red-400/20 rounded-full blur-sm opacity-80"></div>
                
                <div className="relative bg-red-500/10 p-2 rounded-full border border-red-500/20">
                  <Shield className="w-5 h-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                </div>
                
                <div className="absolute -top-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 shadow-[0_0_10px_rgba(34,197,94,0.5)] border border-black/20">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                </div>
              </div>
            ) : (
              <div className="bg-white/5 p-2 rounded-full border border-white/10">
                <Lock className="w-5 h-5 text-white/30 animate-pulse" />
              </div>
            )}
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-[13px] tracking-wide font-bold uppercase ${isEncrypted ? 'text-white' : 'text-white/50'}`}>
                {isEncrypted ? 'End-to-End Encrypted' : 'Establishing Channel'}
              </span>
              {isEncrypted && (
                <span className="flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <span className={`text-[11px] font-medium tracking-tight ${isEncrypted ? 'text-red-200/60' : 'text-white/30'}`}>
              {isEncrypted ? 'Secure direct-transfer active' : 'Securing WebRTC handshake...'}
            </span>
          </div>

          {isEncrypted && (
            <div className="hidden sm:flex ml-2 items-center gap-3 pl-4 border-l border-white/5">
              <div className="flex flex-col items-center">
                <Zap className="w-3.5 h-3.5 text-red-400 opacity-80 animate-pulse" fill="currentColor" />
              </div>
              <div className="flex gap-1.5">
                {[0, 0.2, 0.4].map((delay) => (
                  <div 
                    key={delay}
                    className="w-1 h-1 bg-red-500/40 rounded-full animate-pulse" 
                    style={{ animationDelay: `${delay}s` }}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
