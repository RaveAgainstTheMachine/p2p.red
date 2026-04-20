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

        <footer className="mt-auto py-8 text-center text-xs text-white/30 border-t border-white/5">
          © {new Date().getFullYear()} p2p.red · No trackers, no drama, just files.
        </footer>
      </div>
    </div>
  );
};
