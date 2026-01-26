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
          Back to home base
        </button>

        <div className="glass-card p-8">
          <h1 className="text-3xl font-bold text-white mb-6">How this works (short, not boring)</h1>

          <div className="space-y-6 text-white/80">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Protocol overview (aka the wiring)</h2>
              <p className="leading-relaxed">
                Files move over WebRTC DataChannels between browsers using SCTP. We use a self-hosted PeerJS
                signaling server to exchange connection metadata, then establish a direct peer-to-peer connection
                whenever possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Data integrity & reliability (no funny business)</h2>
              <p className="leading-relaxed mb-2">
                Transfers use WebRTC's reliable, ordered DataChannels and authenticated encryption (AES-GCM), which
                detects tampering or corruption during transit. If integrity checks fail, the transfer stops so you
                can retry safely.
              </p>
              <p className="leading-relaxed mb-2">
                We also compute CRC32 checksums per shard (and a final total) to detect corruption in transit and
                request retransmits when needed.
              </p>
              <p className="text-sm text-white/60">
                Large transfers can be slower on relay connections; direct connections are faster when available.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Adaptive multi-stream transfers (more lanes)</h2>
              <p className="leading-relaxed mb-2">
                Large files are split into shards and sent over multiple parallel WebRTC DataChannels. The sender
                adapts chunk pacing and stream utilization to keep throughput smooth on variable networks.
              </p>
              <p className="text-sm text-white/60">
                This reduces head-of-line stalls and helps steady transfer speeds without server relays.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Relaying (TURN) when direct fails</h2>
              <p className="leading-relaxed mb-2">
                Some networks block peer-to-peer traffic. In those cases, WebRTC can fall back to TURN relays
                (self-hosted) so the connection still works. File data is still end-to-end encrypted; the relay
                cannot read the content.
              </p>
              <p className="text-sm text-white/60">
                Relay connections are slower and have a 100 GB size cap to protect service stability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">End-to-end encryption</h2>
              <p className="leading-relaxed mb-2">
                Files are encrypted in your browser with AES-GCM before transfer. Session keys are derived
                via ECDH and never leave your device. The share link never contains encryption keys.
              </p>
              <p className="text-sm text-white/60">
                We do not store file contents, and we cannot decrypt your files.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Metadata + short links (the tiny stuff)</h2>
              <p className="leading-relaxed mb-2">
                To create short links, we temporarily store minimal metadata: file name, file size, file type,
                peer IDs, and an optional PIN hash. This data is required for the receiver to discover the sender.
              </p>
              <p className="text-sm text-white/60">
                Metadata expires automatically after 24 hours and is cached in Redis for fast lookups.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Session IDs (fresh each time)</h2>
              <p className="leading-relaxed">
                Each browser session generates a randomized PeerJS ID. It changes on page reload and is only used
                to connect peers for the current session.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Cookies + local storage (just essentials)</h2>
              <p className="leading-relaxed">
                We do not use third-party tracking cookies. We store essential preferences (theme, consent state,
                and link expiry display) in localStorage. Analytics are privacy-first and do not profile users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Usage (sending & receiving)</h2>
              <p className="leading-relaxed mb-3"><strong>Sending:</strong> Drop files, choose optional ZIP compression, set a PIN if needed, create the share link, and keep the tab open.</p>
              <p className="leading-relaxed"><strong>Receiving:</strong> Open the link, enter the PIN if required, then download. Both users must be online.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">PIN protection (optional)</h2>
              <p className="leading-relaxed">
                Optional 4-digit PIN with rate limits. Share the PIN separately from the link.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Connection tips (avoid relays)</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Enable UPnP on your router only if you understand the risks and trust your network</li>
                <li>Allow outbound UDP and WebRTC in firewall rules when possible</li>
                <li>Corporate or school networks may force relay or block WebRTC entirely</li>
              </ul>
              <p className="text-sm text-white/60 mt-2">
                UPnP can expose devices to the internet if misconfigured; review guidance from your security authority
                (e.g., cyber.gc.ca). Disable UPnP if you do not need it.
              </p>
              <p className="text-sm text-white/60 mt-2">
                A future desktop app will help with UPnP/firewall setup and enable features browsers limit. No release date yet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Anti-abuse (bots get the boot)</h2>
              <p className="leading-relaxed">
                We use an open-source proof-of-work challenge (Anubis) on metadata endpoints to deter automated abuse
                without tracking users.
              </p>
              <p className="text-sm text-white/60 mt-2">
                Metadata creation is rate-limited and short-lived to reduce automated load and database bloat.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Connection notes (keep both tabs open)</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Both users must be online during transfer</li>
                <li>Links expire after 24 hours</li>
                <li>Some corporate networks can block WebRTC</li>
              </ul>
            </section>

            <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-2">Security tips (still serious)</h2>
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
