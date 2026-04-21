import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

interface LegalProps {
  onBack: () => void;
}

export const Legal: React.FC<LegalProps> = () => {
  return (
    <div className="w-full max-w-4xl">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-white/60 mb-4">
          Legal & Privacy
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
          Terms of Service & Privacy Policy.
        </h1>
        <p className="mt-3 text-white/50 text-base leading-relaxed max-w-2xl">
          We keep it simple, honest, and privacy-first. Here is the legal framework for p2p.red.
        </p>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-8">
          <div className="space-y-8 text-white/80">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <Shield size={20} className="text-[var(--theme-primary)]" />
                Service overview
              </h2>
              <p className="leading-relaxed">
                This service provides peer-to-peer (P2P) file sharing using WebRTC technology. Files are transferred
                between users' browsers without being stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-400" />
                No warranty
              </h2>
              <p className="leading-relaxed mb-4">
                This service is provided "AS IS" without any warranties. We make no guarantees about uptime or data integrity.
              </p>
            </section>

            <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Privacy & compliance</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { t: 'Cookies', d: 'No third-party tracking. Essential localStorage only.' },
                  { t: 'Analytics', d: 'Self-hosted, privacy-first Plausible.' },
                  { t: 'Encryption', d: 'AES-GCM 256-bit. Keys never leave your browser.' },
                  { t: 'Minimal Data', d: 'Metadata exists for 24h then expires forever.' }
                ].map(item => (
                  <div key={item.t} className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-white font-semibold mb-1">{item.t}</div>
                    <div className="text-xs text-white/50">{item.d}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-white/10 pt-8 mt-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-white/40">
                  Last Updated: April 20, 2026
                </div>
                <div className="text-xs text-white/40 italic">
                  Security Moose Approved 🇨🇦
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
