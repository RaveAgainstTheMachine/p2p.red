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
                Files transfer directly between browsers using WebRTC. No uploads to servers, no middleman. 
                Your file goes straight from you to the recipient.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Privacy</h2>
              <p className="leading-relaxed mb-2">
                We don't store your files. Ever. The connection is encrypted end-to-end by default.
              </p>
              <p className="text-sm text-white/60">
                We temporarily store filename, size, and connection IDs for 24 hours to help browsers find each other.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Usage</h2>
              <p className="leading-relaxed mb-3"><strong>Sending:</strong> Drop files, optionally add a PIN, create link, share it. Keep the page open.</p>
              <p className="leading-relaxed"><strong>Receiving:</strong> Open link, enter PIN if needed, download. Both users must be online.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">PIN Protection</h2>
              <p className="leading-relaxed">
                Optional 4-digit PIN. Rate limited to 5 attempts per 15 minutes. Share the PIN separately from the link.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Limitations</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Both users must be online during transfer</li>
                <li>Links expire after 24 hours</li>
                <li>Some corporate firewalls may block P2P connections</li>
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
