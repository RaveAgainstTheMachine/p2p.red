import React from 'react';
import { ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { Logo } from '../components/Logo';

interface LegalProps {
  onBack: () => void;
}

export const Legal: React.FC<LegalProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen app-shell relative overflow-hidden text-white">
      <div className="absolute inset-0 app-overlay-base" />
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift" />
      <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl animate-glow-pulse" />
      <div
        className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl animate-glow-pulse"
        style={{ animationDelay: '1.5s' }}
      />

      <div className="relative z-10 mx-auto px-6 py-8 max-w-4xl min-h-screen flex flex-col">
        {/* Nav */}
        <header className="flex items-center justify-between mb-10">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="text-sm">Back</span>
          </button>
          <button onClick={onBack} className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
            <Logo size="small" />
          </button>
        </header>

        {/* Hero */}
        <div className="mb-10 animate-fade-up">
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

        <div className="space-y-6 animate-fade-up">
          <div className="glass-card p-8">
            <div className="space-y-8 text-white/80">
              <section>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                  <Shield size={20} className="text-blue-400" />
                  Service overview
                </h2>
                <p className="leading-relaxed">
                  This service provides peer-to-peer (P2P) file sharing using WebRTC technology. Files are transferred
                  between users' browsers without being stored on our servers. We provide the signaling infrastructure
                  to establish connections between peers, and a TURN relay may be used when a direct connection cannot
                  be established.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-400" />
                  No warranty
                </h2>
                <p className="leading-relaxed mb-4">
                  This service is provided "AS IS" without any warranties, express or implied. We make no guarantees about:
                </p>
                <ul className="grid gap-2 sm:grid-cols-2 text-sm text-white/60">
                  <li className="flex gap-2"><span>•</span> Service availability or uptime</li>
                  <li className="flex gap-2"><span>•</span> Successful file transfer completion</li>
                  <li className="flex gap-2"><span>•</span> Data integrity or security</li>
                  <li className="flex gap-2"><span>•</span> Compatibility with all devices or networks</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-white mb-4">User responsibilities</h2>
                <p className="leading-relaxed mb-4">
                  By using this service, you agree to:
                </p>
                <ul className="grid gap-3 text-sm text-white/60">
                  <li className="flex gap-3">
                    <span className="text-white/20 font-mono">01</span>
                    Only share files you have the legal right to distribute
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white/20 font-mono">02</span>
                    Not use the service for illegal, harmful, or malicious purposes
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white/20 font-mono">03</span>
                    Verify the identity of file senders before downloading
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white/20 font-mono">04</span>
                    Scan downloaded files with antivirus software
                  </li>
                </ul>
              </section>

              <section className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-semibold text-white mb-4">Privacy & compliance</h2>
                <p className="leading-relaxed mb-6 text-white/60">
                  We are committed to privacy and comply with GDPR (EU), PIPEDA (Canada), and Law 25 (Quebec):
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { t: 'Cookies', d: 'No third-party tracking. Essential localStorage only.' },
                    { t: 'Analytics', d: 'Self-hosted, privacy-first Plausible (no tracking).' },
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

              <section>
                <h2 className="text-xl font-semibold text-white mb-4">Anti-abuse</h2>
                <p className="leading-relaxed">
                  We use an open-source proof-of-work challenge (Anubis) on metadata endpoints to limit automated abuse.
                  This does not track users or require third-party captcha providers.
                </p>
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

        <footer className="mt-auto border-t border-white/10 py-6 text-xs text-white/40 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button onClick={onBack} className="hover:text-white transition-colors">Back to home</button>
            <span className="group relative inline-flex items-center leading-none text-white/40">
              <span className="text-sm" role="img" aria-label="Canada">🇨🇦</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Proudly made in Canada
              </span>
            </span>
            <span>© 2026 Stevem Frost</span>
            <a
              href="https://cv.tee215.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 whitespace-nowrap leading-none text-white/40"
            >
              <span>Logo by</span>
              <span className="text-blue-400 transition-colors group-hover:text-blue-300">T</span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};
