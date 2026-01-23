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
                directly between users' browsers without being stored on our servers. We provide only the signaling 
                infrastructure to establish connections between peers.
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
                <li><strong>No Cookies:</strong> We use only localStorage for essential functionality (consent preferences, link expiry)</li>
                <li><strong>Privacy-first Analytics:</strong> Self-hosted, cookie-free Plausible for anonymous pageview counts (no cross-site tracking)</li>
                <li><strong>True P2P:</strong> Files transferred directly between browsers, never stored on servers</li>
                <li><strong>Minimal Data:</strong> Only metadata (filename, size, peer IDs) temporarily stored for 24 hours</li>
                <li><strong>Automatic Deletion:</strong> All metadata automatically deleted after 24 hours</li>
                <li><strong>No User Accounts:</strong> No registration, no personal information collected</li>
                <li><strong>No Logs:</strong> We do not log IP addresses, file contents, or user-identifiable information</li>
                <li><strong>Encryption Keys:</strong> Generated in your browser and derived via ECDH for each session; never transmitted to or accessible by servers</li>
                <li><strong>Right to Erasure:</strong> Data automatically erased after 24 hours (no manual request needed)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Security Warnings</h2>
              <p className="leading-relaxed mb-3">
                Important security considerations:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Executable files (.exe, .bat, .sh, etc.) can harm your computer</li>
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
