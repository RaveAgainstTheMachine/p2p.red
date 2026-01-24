import React from 'react';
import { ArrowLeft, Shield, AlertTriangle, FileText } from 'lucide-react';

interface LegalProps {
  onBack: () => void;
}

export const Legal: React.FC<LegalProps> = ({ onBack }) => {
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
          <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <FileText size={32} className="text-blue-400" />
            Legal Disclaimer
          </h1>

          <div className="space-y-6 text-white/80">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <Shield size={20} className="text-green-400" />
                Service Overview
              </h2>
              <p className="leading-relaxed">
                This service provides peer-to-peer (P2P) file sharing using WebRTC technology. Files are transferred
                between users' browsers without being stored on our servers. We provide the signaling infrastructure
                to establish connections between peers, and a TURN relay may be used when a direct connection cannot
                be established.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle size={20} className="text-yellow-400" />
                No Warranty
              </h2>
              <p className="leading-relaxed mb-3">
                This service is provided "AS IS" without any warranties, express or implied. We make no guarantees about:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Service availability or uptime</li>
                <li>Successful file transfer completion</li>
                <li>Data integrity or security</li>
                <li>Compatibility with all devices or networks</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">User Responsibilities</h2>
              <p className="leading-relaxed mb-3">
                By using this service, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Only share files you have the legal right to distribute</li>
                <li>Not use the service for illegal, harmful, or malicious purposes</li>
                <li>Verify the identity of file senders before downloading</li>
                <li>Scan downloaded files with antivirus software</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Privacy & Data (GDPR & Canada/Quebec Compliant)</h2>
              <p className="leading-relaxed mb-3">
                We are committed to privacy and comply with GDPR (EU), PIPEDA (Canada), and Law 25 (Quebec):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Cookies:</strong> No third-party tracking cookies. We use localStorage for essential preferences (theme, consent state, link expiry display)</li>
                <li><strong>Privacy-first Analytics:</strong> Self-hosted, cookie-free Plausible for anonymous pageview counts (no cross-site tracking)</li>
                <li><strong>End-to-End Encryption:</strong> Files are encrypted in your browser; keys are derived via ECDH and never sent to servers</li>
                <li><strong>Relay Transparency:</strong> A TURN relay may carry encrypted data when direct connections fail; we cannot read file contents</li>
                <li><strong>Minimal Data:</strong> Only metadata (filename, size, type, peer IDs, optional PIN hash) is stored for up to 24 hours</li>
                <li><strong>Automatic Deletion:</strong> Metadata is automatically deleted after expiration</li>
                <li><strong>No User Accounts:</strong> No registration or personal profile data collected</li>
                <li><strong>Limited Operational Logs:</strong> We avoid logging file contents and sensitive metadata; operational logs may exist for reliability/security</li>
                <li><strong>Right to Erasure:</strong> Data automatically erased after 24 hours (no manual request needed)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Anti-Abuse Controls</h2>
              <p className="leading-relaxed">
                We use an open-source proof-of-work challenge (Anubis) on metadata endpoints to limit automated abuse.
                This does not track users or require third-party captcha providers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Security Warnings</h2>
              <p className="leading-relaxed mb-3">
                Important security considerations:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Executable files (.exe, .msi, .bat, .cmd, .ps1, .sh) can harm your computer</li>
                <li>Macro-enabled documents (.docm, .xlsm) can execute code when opened</li>
                <li>Archives (.zip, .rar) can hide multiple files or nested executables</li>
                <li>Only download files from trusted sources</li>
                <li>PIN protection is optional and provides basic security</li>
                <li>WebRTC connections are encrypted, but verify sender identity</li>
                <li>Corporate firewalls may block P2P connections</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Limitation of Liability</h2>
              <p className="leading-relaxed">
                We shall not be liable for any damages arising from the use or inability to use this service, 
                including but not limited to: data loss, security breaches, malware infections, network issues, 
                or any other direct, indirect, incidental, or consequential damages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Prohibited Uses</h2>
              <p className="leading-relaxed mb-3">
                The following uses are strictly prohibited:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sharing copyrighted material without authorization</li>
                <li>Distributing malware, viruses, or harmful software</li>
                <li>Sharing illegal content of any kind</li>
                <li>Attempting to exploit or attack the service infrastructure</li>
                <li>Using the service to harass, threaten, or harm others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Changes to Terms</h2>
              <p className="leading-relaxed">
                We reserve the right to modify these terms at any time. Continued use of the service after 
                changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="border-t border-white/20 pt-6 mt-6">
              <p className="text-sm text-white/60">
                Last Updated: January 10, 2026
              </p>
              <p className="text-sm text-white/60 mt-2">
                By using this service, you acknowledge that you have read, understood, and agree to be bound 
                by these terms and conditions.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
