import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PinToggleProps {
  onPinChange: (pin: string) => void;
}

export const PinToggle: React.FC<PinToggleProps> = ({ onPinChange }) => {
  const [enabled, setEnabled] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (enabled) {
      const pin = digits.join('');
      onPinChange(pin.length === 4 ? pin : '');
    } else {
      onPinChange('');
    }
  }, [digits, enabled, onPinChange]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled) {
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    } else {
      setDigits(['', '', '', '']);
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
        <span className="text-sm">Add PIN protection</span>
      </button>

      {enabled && (
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
          <p className="text-white/40 text-xs">Enter 4-digit PIN</p>
        </div>
      )}
    </div>
  );
};
