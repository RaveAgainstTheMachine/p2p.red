import React, { useState, useEffect, useMemo, createRef } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface PinVerificationProps {
  onVerify: (pin: string) => void;
  error?: string;
  remainingAttempts?: number;
  isVerifying?: boolean;
}

export const PinVerification: React.FC<PinVerificationProps> = ({ 
  onVerify, 
  error, 
  remainingAttempts,
  isVerifying = false 
}) => {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useMemo(() => (
    [
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>()
    ]
  ), []);

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, [inputRefs]);

  useEffect(() => {
    if (error) {
      setDigits(['', '', '', '']);
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [error, inputRefs]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (index === 3 && value) {
      const pin = [...newDigits.slice(0, 3), value].join('');
      if (pin.length === 4) {
        onVerify(pin);
      }
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
    
    if (pastedData.length === 4) {
      inputRefs[3].current?.focus();
      onVerify(pastedData);
    } else {
      const nextEmptyIndex = newDigits.findIndex(d => !d);
      if (nextEmptyIndex !== -1) {
        inputRefs[nextEmptyIndex].current?.focus();
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="flex items-center gap-3 text-white">
        <Lock size={24} className="text-blue-400" />
        <h3 className="text-xl font-semibold">PIN Required</h3>
      </div>

      <p className="text-white/60 text-center">
        This file is protected. Enter the 4-digit PIN to continue.
      </p>

      <div className="flex gap-3">
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
            disabled={isVerifying}
            className={`w-14 h-16 text-center text-2xl font-bold bg-white/5 border-2 rounded-lg 
                       text-white focus:outline-none transition-colors
                       ${error ? 'border-red-400 animate-shake' : 'border-white/20 focus:border-blue-400'}
                       ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-w-sm">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">{error}</p>
            {remainingAttempts !== undefined && remainingAttempts > 0 && (
              <p className="text-red-300 text-xs mt-1">
                {remainingAttempts} {remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining
              </p>
            )}
          </div>
        </div>
      )}

      {isVerifying && (
        <div className="flex items-center gap-2 text-white/60">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Verifying...</span>
        </div>
      )}
    </div>
  );
};
