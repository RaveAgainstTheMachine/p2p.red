import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, QrCode, Mail, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareLinkProps {
  shareLink: string;
  onCopy?: () => void;
}

export const ShareLink: React.FC<ShareLinkProps> = ({ shareLink, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if Web Share API is available (mobile browsers)
    setCanShare(!!navigator.share);
  }, []);

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

  const buildQrDataUrl = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return null;
    const serialized = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  };

  const handleEmailShare = async () => {
    const qrDataUrl = buildQrDataUrl();
    const subject = encodeURIComponent('I shared a file with you');
    const bodyContent = qrDataUrl
      ? (
        `<p>I shared a file with you using p2p.red.</p>` +
        `<p><strong>Grab it here:</strong><br />${shareLink}</p>` +
        `<p>Or scan this QR code:</p>` +
        `<p><img src="${qrDataUrl}" alt="QR code" width="200" height="200" /></p>` +
        `<p>Note: The sender needs to keep their page open until the transfer completes.</p>` +
        `<p>---<br />Secure P2P file sharing with end-to-end encryption<br />https://p2p.red</p>`
      )
      : (
        `I shared a file with you using p2p.red\n\n` +
        `Grab it here:\n${shareLink}\n\n` +
        `Or scan this QR code:\n${shareLink.replace('#', '%23')}\n\n` +
        `Note: The sender needs to keep their page open until the transfer completes.\n\n` +
        `---\n` +
        `Secure P2P file sharing with end-to-end encryption\n` +
        `https://p2p.red`
      );
    const body = encodeURIComponent(bodyContent);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    
    try {
      await navigator.share({
        title: 'Here’s the file',
        text: `Grab this file on p2p.red`,
        url: shareLink
      });
    } catch (err) {
      // User cancelled or share failed
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const handleSocialShare = async (platform: string) => {
    const text = encodeURIComponent('Here’s the file I shared with you');
    // Extract short key from hash and create /share/ URL for better previews
    const shortKey = shareLink.split('#')[1];
    const previewUrl = `https://p2p.red/share/${shortKey}`;
    const url = encodeURIComponent(previewUrl);
    
    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      discord: `https://discord.com/channels/@me`, // Open Discord directly
    };
    
    if (platform === 'discord') {
      // Open Discord and copy rich preview link for better social media display
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      window.open(shareUrls.discord, '_blank');
    } else {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      <h2 className="text-xl font-bold text-white">
        Here’s your share link, bud:
      </h2>
      
      <div 
        className="relative w-fit bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 pr-14"
      >
        <code className="text-[var(--theme-primary)] text-base whitespace-nowrap block max-w-[280px] sm:max-w-md overflow-hidden text-ellipsis">
          {shareLink}
        </code>
        
        <button
          onClick={handleCopy}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90"
          title="Copy link"
        >
          {copied ? (
            <Check size={20} className="text-green-400" />
          ) : (
            <Copy size={20} className="opacity-60" />
          )}
        </button>
      </div>
      
      <div className="flex flex-col gap-3 items-center">
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={handleCopy}
            className="btn-primary flex items-center gap-2"
          >
            <Share2 size={20} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn-secondary flex items-center gap-2"
            title="Show QR code"
          >
            <QrCode size={20} />
            QR code
          </button>
          
          {canShare && (
            <button
              onClick={handleNativeShare}
              className="btn-secondary flex items-center gap-2"
              title="Share with friends nearby"
          >
            <Smartphone size={20} />
            <span className="hidden sm:inline">Share with friends</span>
          </button>
          )}
        </div>
        
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={handleEmailShare}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Share via email"
          >
            <Mail size={18} className="text-[var(--theme-primary)]" />
          </button>
          <button
            onClick={() => handleSocialShare('facebook')}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Share on Facebook"
          >
            <svg className="w-[18px] h-[18px] text-[var(--theme-primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </button>
          <button
            onClick={() => handleSocialShare('twitter')}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Share on X (Twitter)"
          >
            <svg className="w-[18px] h-[18px] text-[var(--theme-primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
          <button
            onClick={() => handleSocialShare('whatsapp')}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Share on WhatsApp"
          >
            <svg className="w-[18px] h-[18px] text-[var(--theme-primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </button>
          <button
            onClick={() => handleSocialShare('telegram')}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Share on Telegram"
          >
            <svg className="w-[18px] h-[18px] text-[var(--theme-primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </button>
          <button
            onClick={() => handleSocialShare('discord')}
            className="p-2 rounded-lg bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 transition-colors"
            title="Open Discord & copy link"
          >
            <svg className="w-[18px] h-[18px] text-[var(--theme-primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div ref={qrRef} className="absolute -left-[9999px] -top-[9999px] opacity-0" aria-hidden="true">
        <QRCodeSVG value={shareLink} size={200} level="H" />
      </div>

      {showQR && (
        <div className="bg-white p-4 rounded-lg">
          <QRCodeSVG value={shareLink} size={200} level="H" />
          <p className="text-gray-600 text-xs text-center mt-2">Scan to download</p>
        </div>
      )}
      
      {copied && (
        <p className="text-green-400 text-sm">
          Link copied. Go forth and share.
        </p>
      )}
    </div>
  );
};
