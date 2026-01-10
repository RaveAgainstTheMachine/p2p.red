import { Shield, Lock, Check } from 'lucide-react';

interface EncryptionIndicatorProps {
  isEncrypted: boolean;
  isVisible: boolean;
}

export function EncryptionIndicator({ isEncrypted, isVisible }: EncryptionIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-center mb-6">
      <div className={`
        flex items-center gap-3 px-6 py-3 rounded-full
        ${isEncrypted 
          ? 'bg-green-500/20 border-2 border-green-500 text-green-400' 
          : 'bg-gray-500/20 border-2 border-gray-500 text-gray-400'
        }
        transition-all duration-300 animate-in fade-in slide-in-from-top-4
      `}>
        <div className="relative">
          {isEncrypted ? (
            <>
              <Shield className="w-6 h-6" />
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                <Check className="w-3 h-3 text-white" />
              </div>
            </>
          ) : (
            <Lock className="w-6 h-6" />
          )}
        </div>
        
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {isEncrypted ? 'End-to-End Encrypted' : 'Establishing Encryption...'}
          </span>
          <span className="text-xs opacity-80">
            {isEncrypted ? 'Secure P2P connection active' : 'Connecting...'}
          </span>
        </div>
        
        {isEncrypted && (
          <div className="ml-2 flex gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-75"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-150"></div>
          </div>
        )}
      </div>
    </div>
  );
}
