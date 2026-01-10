import React, { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';

interface ShareLinkProps {
  shareLink: string;
  onCopy?: () => void;
}

export const ShareLink: React.FC<ShareLinkProps> = ({ shareLink, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      onCopy?.();
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      <h2 className="text-xl font-bold text-white">
        Share this link:
      </h2>
      
      <div 
        style={{ 
          position: 'relative',
          width: 'fit-content',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.75rem',
          padding: '1rem',
          paddingRight: '3.5rem'
        }}
      >
        <code style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem', whiteSpace: 'nowrap' }}>
          {shareLink}
        </code>
        
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255, 255, 255, 0.9)',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          title="Copy link"
        >
          {copied ? (
            <Check size={20} className="text-green-400" />
          ) : (
            <Copy size={20} />
          )}
        </button>
      </div>
      
      <button
        onClick={handleCopy}
        className="btn-primary flex items-center gap-2"
      >
        <Share2 size={20} />
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
      
      {copied && (
        <p className="text-green-400 text-sm">
          Link copied to clipboard!
        </p>
      )}
    </div>
  );
};
