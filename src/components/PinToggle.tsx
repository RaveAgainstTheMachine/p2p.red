import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PinToggleProps {
  onPinChange: (pin: string) => void;
}

export const PinToggle: React.FC<PinToggleProps> = ({ onPinChange }) => {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'pin' | 'passphrase'>('pin');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [passphrase, setPassphrase] = useState('');
  const passphraseRef = useRef<HTMLInputElement>(null);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (!enabled) {
      onPinChange('');
      return;
    }

    if (mode === 'pin') {
      const pin = digits.join('');
      const finalPin = pin.length === 4 ? pin : '';
      onPinChange(finalPin);
      return;
    }

    const value = passphrase;
    onPinChange(value.length > 0 ? value : '');
  }, [digits, enabled, mode, onPinChange, passphrase]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled) {
      setTimeout(() => {
        if (mode === 'pin') {
          inputRefs[0].current?.focus();
        } else {
          passphraseRef.current?.focus();
        }
      }, 100);
    } else {
      setDigits(['', '', '', '']);
      setPassphrase('');
    }
  };

  const handleModeChange = (nextMode: 'pin' | 'passphrase') => {
    setMode(nextMode);
    if (nextMode === 'pin') {
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    } else {
      setTimeout(() => passphraseRef.current?.focus(), 100);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    const newDigits = [...digits];
    
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    
    setDigits(newDigits);
    
    const nextEmptyIndex = newDigits.findIndex(d => !d);
    if (nextEmptyIndex !== -1) {
      inputRefs[nextEmptyIndex].current?.focus();
    } else {
      inputRefs[3].current?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <div className={`w-10 h-6 rounded-full transition-colors ${
          enabled ? 'bg-blue-500' : 'bg-white/20'
        } relative`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`} />
        </div>
        <Lock size={16} />
        <span className="text-sm">Add a PIN, just in case</span>
      </button>

      {enabled && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <button
              type="button"
              onClick={() => handleModeChange('pin')}
              className={`px-3 py-1 rounded-full border transition-colors ${
                mode === 'pin'
                  ? 'border-blue-400 text-white'
                  : 'border-white/20 text-white/50 hover:text-white'
              }`}
            >
              4-digit PIN
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('passphrase')}
              className={`px-3 py-1 rounded-full border transition-colors ${
                mode === 'passphrase'
                  ? 'border-blue-400 text-white'
                  : 'border-white/20 text-white/50 hover:text-white'
              }`}
            >
              Passphrase
            </button>
          </div>

          {mode === 'pin' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={inputRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border-2 border-white/20 
                             rounded-lg text-white focus:outline-none focus:border-blue-400 transition-colors"
                  />
                ))}
              </div>
              <p className="text-white/40 text-xs">Type a 4‑digit PIN</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full max-w-sm">
              <input
                ref={passphraseRef}
                type="password"
                value={passphrase}
                maxLength={128}
                placeholder="Enter a passphrase"
                onChange={(event) => setPassphrase(event.target.value)}
                className="w-full px-4 py-3 bg-white/5 border-2 border-white/20 rounded-lg text-white 
                         focus:outline-none focus:border-blue-400 transition-colors"
              />
              <p className="text-white/40 text-xs">Up to 128 characters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
