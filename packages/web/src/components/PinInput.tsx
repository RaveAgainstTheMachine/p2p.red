import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PinInputProps {
  onPinChange: (pin: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export const PinInput: React.FC<PinInputProps> = ({ 
  onPinChange, 
  label = "Optional 4-digit PIN",
  placeholder = "Enter 4-digit PIN",
  error 
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
    onPinChange(value);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-white/80 mb-2">
        <Lock size={16} className="inline mr-2" />
        {label}
      </label>
      <div className="relative">
        <input
          type={showPin ? 'text' : 'password'}
          value={pin}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg
                     text-white placeholder-white/40 focus:outline-none focus:border-blue-400
                     transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPin(!showPin)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90"
        >
          {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}
      <p className="text-white/40 text-xs mt-1">
        Add extra security to your share link (optional)
      </p>
    </div>
  );
};
