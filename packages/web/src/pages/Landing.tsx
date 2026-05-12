import React from 'react';
import { ArrowRight, Shield, Share2, Zap, Database, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';

interface LandingProps {
  onStart: () => void;
  onInfo: () => void;
  onLegal: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onInfo, onLegal }) => {
  return (
    <div className="min-h-screen app-shell relative overflow-hidden text-white">
      <div className="absolute inset-0 app-overlay-base" />
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift" />
      <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl animate-glow-pulse" />
      <div
        className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl animate-glow-pulse"
        style={{ animationDelay: '1.5s' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo size="small" />
            <div>
              <div className="text-sm uppercase tracking-[0.3em] text-white/50">p2p.red</div>
              <div className="text-lg font-semibold">Secure P2P File Share</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onInfo}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={onLegal}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Legal
            </button>
            <button
              type="button"
              onClick={onStart}
              className="btn-primary inline-flex items-center gap-2 rounded-full px-5"
            >
              Start sharing
              <ArrowRight size={16} />
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-16 py-12">
          <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/70 animate-fade-up">
                <Sparkles size={14} className="text-cyan-200" />
                Private by design
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
                Share files at native WebRTC speed — direct, encrypted, and uncompromised.
              </h1>
              <p className="text-lg text-white/70 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                p2p.red connects browsers directly with WebRTC DataChannels. When direct paths fail, we fall back to
                TURN relays without ever touching your file contents. Short links, no accounts, no tracking.
              </p>
              <div className="flex flex-wrap gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
                <button type="button" onClick={onStart} className="btn-primary inline-flex items-center gap-2">
                  Start sharing now
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={onInfo}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  Explore the tech
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="glass-card p-4 text-sm text-white/70 animate-fade-up" style={{ animationDelay: '0.4s' }}>
                  <div className="text-white font-semibold">Direct P2P, relay fallback</div>
                  <p className="mt-1">Fast paths whenever possible, resilient when networks are strict.</p>
                </div>
                <div className="glass-card p-4 text-sm text-white/70 animate-fade-up" style={{ animationDelay: '0.5s' }}>
                  <div className="text-white font-semibold">End-to-end encrypted</div>
                  <p className="mt-1">ECDH + AES-GCM with keys generated in your browser.</p>
                </div>
              </div>
            </div>

            <div className="glass-card relative overflow-hidden p-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.2em] text-white/50">Transfer status</div>
                    <div className="text-2xl font-semibold">Relay-free whenever possible</div>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">Live</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Share2 size={18} className="text-blue-200" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Encrypted shards</div>
                      <div className="text-sm text-white/60">CRC32 verified, retransmit on mismatch</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Shield size={18} className="text-purple-200" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Zero file storage</div>
                      <div className="text-sm text-white/60">Servers never store file contents.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <Zap size={18} className="text-pink-200" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Adaptive multi-stream</div>
                      <div className="text-sm text-white/60">Parallel DataChannels that balance pacing on the fly.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Shield,
                title: 'Privacy-first by default',
                copy: 'No accounts, no tracking cookies, and keys never leave your device.'
              },
              {
                icon: Database,
                title: 'Metadata minimized',
                copy: 'Only filename, size, type, peer IDs, and optional PIN hash for 24 hours.'
              },
              {
                icon: Zap,
                title: 'Integrity verified',
                copy: 'Reliable DataChannels plus CRC32 checks per shard to catch corruption.'
              }
            ].map((item, index) => (
              <div
                key={item.title}
                className="glass-card p-6 text-white/70 animate-fade-up"
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <item.icon size={18} className="text-white/80" />
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-white/60">{item.copy}</p>
              </div>
            ))}
          </section>

          <section className="glass-card flex flex-col items-center gap-4 p-6 text-center animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="text-sm uppercase tracking-[0.3em] text-white/50">Ready to move fast?</div>
            <h2 className="text-2xl font-semibold text-white">Create a link. Share it. Transfer directly.</h2>
            <p className="max-w-2xl text-sm text-white/60">
              Keep both browsers open during the transfer. Direct connections are fastest; relay fallback keeps things
              moving when networks are strict.
            </p>
            <button type="button" onClick={onStart} className="btn-primary inline-flex items-center gap-2">
              Launch file share
              <ArrowRight size={16} />
            </button>
          </section>
        </main>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50">
          <div>© {new Date().getFullYear()} p2p.red</div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="mailto:webmaster@p2p.red"
              className="transition hover:text-white"
            >
              webmaster@p2p.red
            </a>
            <a
              href="mailto:legal@p2p.red"
              className="transition hover:text-white"
            >
              legal@p2p.red
            </a>
            <button
              type="button"
              onClick={onInfo}
              className="transition hover:text-white"
            >
              Info
            </button>
            <button
              type="button"
              onClick={onLegal}
              className="transition hover:text-white"
            >
              Legal
            </button>
            <button
              type="button"
              onClick={onStart}
              className="transition hover:text-white"
            >
              Start sharing
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
