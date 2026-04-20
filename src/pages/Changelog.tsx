import React from 'react';
import { ArrowLeft, Clock, Zap, Shield, CheckCircle, PlusCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { changelog } from '../data/changelog';

interface ChangelogProps {
  onBack: () => void;
}

export const Changelog: React.FC<ChangelogProps> = ({ onBack }) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'Added': return <PlusCircle size={14} className="text-green-400" />;
      case 'Improved': return <Zap size={14} className="text-blue-400" />;
      case 'Fixed': return <CheckCircle size={14} className="text-yellow-400" />;
      case 'Security': return <Shield size={14} className="text-purple-400" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen app-shell relative overflow-hidden text-white flex flex-col">
      <div className="fixed inset-0 app-overlay-base" />
      <div className="fixed inset-0 app-overlay-accent animate-gradient-shift" />
      
      <div className="relative z-10 mx-auto w-full max-w-3xl flex flex-col px-6 py-8 flex-1">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="small" />
            <div>
              <h1 className="text-xl font-bold">Change Log</h1>
              <p className="text-xs text-white/50 uppercase tracking-widest">Evolution of p2p.red</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="btn-secondary flex items-center gap-2 !px-4 !py-2 text-sm"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </header>

        <main className="space-y-8 pb-20">
          {changelog.map((entry, index) => (
            <section 
              key={entry.version} 
              className="glass-card p-8 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    v{entry.version}
                  </span>
                  <div className="flex items-center gap-1.5 text-white/40 text-sm bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Clock size={14} />
                    {new Date(entry.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>

              <ul className="space-y-4">
                {entry.changes.map((change, cIdx) => (
                  <li key={cIdx} className="flex gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {getIcon(change.category)}
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-white/30 mr-2">
                        {change.category}
                      </span>
                      <p className="text-white/80 leading-relaxed">
                        {change.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>

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
