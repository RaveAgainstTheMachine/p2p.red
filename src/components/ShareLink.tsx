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
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-white text-center mb-4">
        Share this link:
      </h2>
      
      <div className="relative group">
        <div className="glass-card p-4 pr-12">
          <code className="text-white/90 text-base whitespace-nowrap block overflow-hidden text-ellipsis">
            {shareLink}
          </code>
        </div>
        
        <button
          onClick={handleCopy}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg
                     bg-white/10 hover:bg-white/20 transition-all duration-200
                     text-white/80 hover:text-white"
          title="Copy link"
        >
          {copied ? (
            <Check size={20} className="text-green-400" />
          ) : (
            <Copy size={20} />
          )}
        </button>
      </div>
      
      <div className="flex justify-center mt-6">
        <button
          onClick={handleCopy}
          className="btn-primary flex items-center gap-2"
        >
          <Share2 size={20} />
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
      
      {copied && (
        <div className="text-center mt-4">
          <p className="text-green-400 text-sm">
            Link copied to clipboard!
          </p>
        </div>
      )}
    </div>
  );
};
