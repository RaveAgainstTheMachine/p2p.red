import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface InfoProps {
  onBack: () => void;
}

export const Info: React.FC<InfoProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      <div className="fixed inset-0 bg-black/20" />
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 animate-gradient-shift" />
      
      <div className="relative z-10 mx-auto px-4 py-6 max-w-4xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="glass-card p-8">
          <h1 className="text-3xl font-bold text-white mb-6">How It Works</h1>

          <div className="space-y-6 text-white/80">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Direct Browser-to-Browser Transfer</h2>
              <p className="leading-relaxed">
                Files move over WebRTC DataChannels between browsers. There is no server relay of file data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Privacy + Encryption</h2>
              <p className="leading-relaxed mb-2">
                Files are encrypted in your browser with AES-GCM before transfer. Session keys are derived
                via ECDH over the WebRTC DataChannel, so no keys are shared in URLs or sent to servers.
              </p>
              <p className="text-sm text-white/60">
                We temporarily store minimal metadata (filename, size, peer IDs) for up to 24 hours to help peers connect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Usage</h2>
              <p className="leading-relaxed mb-3"><strong>Sending:</strong> Drop files, choose optional ZIP compression, set a PIN if needed, create the share link, and keep the tab open.</p>
              <p className="leading-relaxed"><strong>Receiving:</strong> Open the link, enter the PIN if required, then download. Both users must be online.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">PIN Protection</h2>
              <p className="leading-relaxed">
                Optional 4-digit PIN with rate limits. Share the PIN separately from the link.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Connection Notes</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Both users must be online during transfer</li>
                <li>Links expire after 24 hours</li>
                <li>Some corporate networks can block WebRTC</li>
              </ul>
            </section>

            <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-2">Security Tips</h2>
              <ul className="space-y-1 text-sm">
                <li>• Only download from trusted sources</li>
                <li>• Scan executables with antivirus</li>
                <li>• Verify sender identity separately</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
