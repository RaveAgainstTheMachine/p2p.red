import { ArrowRight, Shield, Share2, Zap, Database, Sparkles } from 'lucide-react';
import { siteName } from '../config/environments';

interface LandingProps {
  onStart: () => void;
  onInfo: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onInfo }) => {
  return (
    <div className="w-full max-w-6xl">
      <main className="flex flex-col justify-center gap-16 py-12">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-red-200 shadow-[0_0_20px_rgba(176,18,3,0.2)]">
              <Sparkles size={14} className="text-red-400" />
              Direct-to-Peer Protocol
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Share files at native </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">WebRTC speed.</span>
            </h1>
            <p className="text-lg text-white/70">
              {siteName} connects browsers directly with WebRTC DataChannels. When direct paths fail, we fall back to
              TURN relays without ever touching your file contents. Short links, no accounts, no drama.
            </p>
            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={onStart} className="btn-primary inline-flex items-center gap-2">
                Start sharing now
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={onInfo}
                className="btn-secondary inline-flex items-center gap-2"
              >
                Explore the tech (with snacks)
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass-card p-4 text-sm text-white/70">
                <div className="text-white font-semibold">Direct P2P, relay fallback</div>
                <p className="mt-1">Fast when it can be, resilient when networks are cranky.</p>
              </div>
              <div className="glass-card p-4 text-sm text-white/70">
                <div className="text-white font-semibold">End-to-end encrypted</div>
                <p className="mt-1">ECDH + AES-GCM with keys born and raised in your browser.</p>
              </div>
            </div>
          </div>

          <div className="glass-card relative overflow-hidden p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-white/50">Transfer status</div>
                  <div className="text-2xl font-semibold">Relay‑free whenever possible</div>
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
                    <div className="text-sm text-white/60">CRC32 verified, retransmit if things look funny</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Shield size={18} className="text-purple-200" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Zero file storage</div>
                    <div className="text-sm text-white/60">Servers never store file contents. Pinky promise.</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <Zap size={18} className="text-pink-200" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">Adaptive multi-stream</div>
                    <div className="text-sm text-white/60">Parallel DataChannels that keep the pace steady.</div>
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
          ].map((item) => (
            <div
              key={item.title}
              className="glass-card p-6 text-white/70"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <item.icon size={18} className="text-white/80" />
              </div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-white/60">{item.copy}</p>
            </div>
          ))}
        </section>

        <section className="glass-card flex flex-col items-center gap-4 p-6 text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-white/50">Ready to move fast?</div>
          <h2 className="text-2xl font-semibold text-white">Create a link. Share it. Keep the tab open.</h2>
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
    </div>
  );
};
