import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const CookieBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900/95 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 text-sm text-white/80">
          <p className="mb-2">
            <strong className="text-white">Privacy Notice:</strong> We use minimal localStorage for functionality only (link expiry, consent preferences). 
            We also use self-hosted, cookie-free Plausible analytics for anonymous pageview counts. Your files never touch our servers.
          </p>
          <p className="text-xs text-white/60">
            GDPR & Canada/Quebec compliant. Data retention: 24 hours max. No user-identifiable information stored.
          </p>
        </div>
        
        <div className="flex gap-3 items-center">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-white/80 hover:text-white transition-colors text-sm"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="p-2 text-white/60 hover:text-white transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
