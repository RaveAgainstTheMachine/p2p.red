import React from 'react';
import { ArrowLeft, Radio, Shield, Zap, Link2, Lock, Database, User, Cookie, AlertTriangle, Wifi, Bot } from 'lucide-react';
import { Logo } from '../components/Logo';

interface InfoProps {
  onBack: () => void;
}

interface Section {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    icon: Radio,
    iconColor: 'text-blue-300',
    title: 'Protocol overview',
    body: (
      <p>
        Files move over WebRTC DataChannels between browsers using SCTP. A self-hosted PeerJS
        signaling server exchanges connection metadata to establish a direct peer-to-peer path
        whenever the network allows it.
      </p>
    ),
  },
  {
    icon: Shield,
    iconColor: 'text-green-300',
    title: 'End-to-end encryption',
    body: (
      <>
        <p>
          Files are encrypted in your browser before transfer using AES-GCM 256-bit. Session keys are
          derived via ECDH (P-256 curve) and never leave your device. The share link never contains
          encryption keys.
        </p>
        <p className="mt-2 text-white/50 text-sm">
          We do not store file contents. We cannot decrypt your files.
        </p>
      </>
    ),
  },
  {
    icon: Zap,
    iconColor: 'text-yellow-300',
    title: 'Adaptive multi-stream transfers',
    body: (
      <>
        <p>
          Large files are split into shards and sent over up to 64 parallel WebRTC DataChannels.
          The sender adapts chunk size and stream count to keep throughput smooth on variable networks.
        </p>
        <p className="mt-2 text-white/50 text-sm">
          Reduces head-of-line stalls and steadies transfer speeds without server relays.
        </p>
      </>
    ),
  },
  {
    icon: Shield,
    iconColor: 'text-purple-300',
    title: 'Data integrity',
    body: (
      <>
        <p>
          Transfers use WebRTC's reliable, ordered DataChannels plus AES-GCM authentication. CRC32
          checksums are computed per shard to detect corruption. If integrity checks fail, the
          transfer stops so you can retry safely.
        </p>
      </>
    ),
  },
  {
    icon: Wifi,
    iconColor: 'text-cyan-300',
    title: 'Relay fallback (TURN)',
    body: (
      <>
        <p>
          Some networks block peer-to-peer traffic. In those cases, WebRTC falls back to our
          self-hosted TURN relay. File data is still end-to-end encrypted — the relay cannot read it.
        </p>
        <p className="mt-2 text-white/50 text-sm">
          Relay connections are limited to 100 GB to protect service stability.
        </p>
      </>
    ),
  },
  {
    icon: Link2,
    iconColor: 'text-pink-300',
    title: 'Metadata & short links',
    body: (
      <>
        <p>
          To create short links, we temporarily store minimal metadata: file name, size, type, peer IDs,
          and an optional PIN hash. This is required for the receiver to discover the sender.
        </p>
        <p className="mt-2 text-white/50 text-sm">
          Metadata expires automatically after 24 hours and is cached in Redis for fast lookups.
        </p>
      </>
    ),
  },
  {
    icon: Lock,
    iconColor: 'text-orange-300',
    title: 'PIN protection',
    body: (
      <p>
        Optional PIN or passphrase protection with rate-limited attempts. Share the PIN separately
        from the link for an extra layer of security.
      </p>
    ),
  },
  {
    icon: User,
    iconColor: 'text-blue-200',
    title: 'Session IDs',
    body: (
      <p>
        Each browser session generates a randomized PeerJS ID. It changes on page reload and is
        only used to connect peers for the current session.
      </p>
    ),
  },
  {
    icon: Cookie,
    iconColor: 'text-amber-300',
    title: 'Cookies & local storage',
    body: (
      <p>
        No third-party tracking cookies. We store essential preferences — theme, consent state,
        and resume transfer sessions — in localStorage. Analytics are privacy-first and do not
        profile users.
      </p>
    ),
  },
  {
    icon: Bot,
    iconColor: 'text-red-300',
    title: 'Anti-abuse (bots get the boot)',
    body: (
      <>
        <p>
          We use an open-source proof-of-work challenge (Anubis) on metadata endpoints to deter
          automated abuse without tracking users.
        </p>
        <p className="mt-2 text-white/50 text-sm">
          Metadata creation is rate-limited and short-lived to reduce automated load.
        </p>
      </>
    ),
  },
  {
    icon: Database,
    iconColor: 'text-indigo-300',
    title: 'Infrastructure',
    body: (
      <p>
        Self-hosted on an OVH VPS with Docker, Envoy, Nginx, PostgreSQL, Redis, and OpenBao
        for secrets management. Full control over the stack — no third-party clouds storing your metadata.
      </p>
    ),
  },
];

const faqs = [
  {
    q: 'Is this actually peer-to-peer?',
    a: 'Yes. Files go browser-to-browser via WebRTC DataChannels. If a direct path fails, a TURN relay may carry encrypted data.',
  },
  {
    q: 'Do I need an account?',
    a: 'No account required. Drop a file, get a link, share it.',
  },
  {
    q: 'How long do links last?',
    a: 'Links expire after 24 hours to keep things tidy.',
  },
  {
    q: 'Will it work on restricted networks?',
    a: 'Some work or school networks block WebRTC or force relays. If it\'s grumpy, try a different network.',
  },
  {
    q: 'Do session IDs persist?',
    a: 'Nope. Each page load generates a fresh PeerJS ID that exists only for that session.',
  },
  {
    q: 'What are the connection tips?',
    a: 'Disable VPN/proxy, allow outbound UDP and WebRTC in your firewall, and avoid corporate networks when possible for best speeds.',
  },
];

export const Info: React.FC<InfoProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen app-shell relative overflow-hidden text-white">
      <div className="absolute inset-0 app-overlay-base" />
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift" />
      <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl animate-glow-pulse" />
      <div
        className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl animate-glow-pulse"
        style={{ animationDelay: '1.5s' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
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
            How it works
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">
            Privacy-first file sharing — the wiring explained.
          </h1>
          <p className="mt-3 text-white/50 text-base leading-relaxed max-w-2xl">
            p2p.red uses WebRTC to send files directly between browsers. Here's exactly what happens
            under the hood — no hand-waving.
          </p>
        </div>

        {/* Sections grid */}
        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          {sections.map((section, i) => (
            <div
              key={section.title}
              className="glass-card p-5 animate-fade-up"
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 flex-shrink-0">
                  <section.icon size={17} className={section.iconColor} />
                </div>
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
              </div>
              <div className="text-sm text-white/60 leading-relaxed">
                {section.body}
              </div>
            </div>
          ))}
        </div>

        {/* Security callout */}
        <div className="glass-card border border-amber-500/20 bg-amber-500/5 p-5 mb-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={17} className="text-amber-300 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-white">Security reminders</h2>
          </div>
          <ul className="text-sm text-white/60 space-y-1.5">
            <li>• Only download files from people you trust</li>
            <li>• Scan executables with antivirus before running them</li>
            <li>• Verify sender identity through a separate channel if in doubt</li>
          </ul>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Frequently asked questions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="glass-card p-5">
                <p className="text-sm font-semibold text-white mb-1.5">{faq.q}</p>
                <p className="text-sm text-white/60 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Usage quick guide */}
        <div className="glass-card p-6 mb-10 animate-fade-up">
          <h2 className="text-sm font-semibold text-white mb-4">How to use it</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Sending</div>
              <ol className="space-y-2 text-sm text-white/60">
                <li className="flex gap-2"><span className="text-white/30 font-mono">1.</span> Drop your files on the transfer page</li>
                <li className="flex gap-2"><span className="text-white/30 font-mono">2.</span> Set a PIN if needed</li>
                <li className="flex gap-2"><span className="text-white/30 font-mono">3.</span> Copy and share the link</li>
                <li className="flex gap-2"><span className="text-white/30 font-mono">4.</span> Keep the tab open until download completes</li>
              </ol>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">Receiving</div>
              <ol className="space-y-2 text-sm text-white/60">
                <li className="flex gap-2"><span className="text-white/30 font-mono">1.</span> Open the share link</li>
                <li className="flex gap-2"><span className="text-white/30 font-mono">2.</span> Enter the PIN if required</li>
                <li className="flex gap-2"><span className="text-white/30 font-mono">3.</span> Click download and keep the tab open</li>
              </ol>
            </div>
          </div>
        </div>

        <footer className="mt-auto border-t border-white/10 pt-6 text-xs text-white/40 flex items-center justify-between">
          <span>© {new Date().getFullYear()} p2p.red</span>
          <button onClick={onBack} className="hover:text-white transition-colors">Back to file share</button>
        </footer>
      </div>
    </div>
  );
};
