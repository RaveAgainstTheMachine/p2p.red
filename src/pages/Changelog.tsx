import React from 'react';
import { Clock, Zap, Shield, CheckCircle, PlusCircle } from 'lucide-react';
import { changelog } from '../data/changelog';

interface ChangelogProps {
  onBack: () => void;
}

export const Changelog: React.FC<ChangelogProps> = () => {
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
    <div className="w-full max-w-3xl">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Change Log</h1>
        <p className="text-sm text-white/50 uppercase tracking-widest">Evolution of p2p.red</p>
      </header>

      <main className="space-y-8">
        {changelog.map((entry) => (
          <section 
            key={entry.version} 
            className="glass-card p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold bg-gradient-to-r from-[var(--theme-primary)] to-purple-400 bg-clip-text text-transparent">
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
    </div>
  );
};
