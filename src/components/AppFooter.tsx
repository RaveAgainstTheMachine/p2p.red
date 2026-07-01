import React, { useState } from 'react';
import { Coffee, Menu, X, Sun, Moon, Shuffle, CloudSun, Check } from 'lucide-react';
import { Monitoring } from './Monitoring';
import { Logo } from './Logo';

import { siteDomain } from '../config/environments';

const THEMES = [
  { id: 'random', name: 'Random' },
  { id: 'indigo', name: 'Indigo', colors: ['#6366f1', '#a855f7'] },
  { id: 'emerald', name: 'Emerald', colors: ['#10b981', '#0d9488'] },
  { id: 'rose', name: 'Rose', colors: ['#f43f5e', '#e11d48'] },
  { id: 'amber', name: 'Amber', colors: ['#f59e0b', '#d97706'] },
  { id: 'cyan', name: 'Cyan', colors: ['#06b6d4', '#0891b2'] },
  { id: 'slate', name: 'Slate', colors: ['#64748b', '#475569'] },
  { id: 'crimson', name: 'Crimson', colors: ['#dc2626', '#991b1b'] },
  { id: 'violet', name: 'Violet', colors: ['#8b5cf6', '#7c3aed'] },
  { id: 'lime', name: 'Lime', colors: ['#84cc16', '#65a30d'] },
  { id: 'ebony', name: 'Ebony', colors: ['#1e293b', '#0f172a'] },
] as const;

interface AppFooterProps {
  onNavigate: (page: 'landing' | 'home' | 'legal' | 'info' | 'feedback') => void;
  displayVersion?: string;
  buildIndicatorClass?: string;
  buildIndicatorLabel?: string;
  themePreference?: string;
  variantPreference?: string;
  onSetTheme?: (t: string) => void;
  onSetVariant?: (v: string) => void;
  onMooseClick?: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ 
  onNavigate, 
  displayVersion = 'v1.5.8',
  buildIndicatorClass,
  buildIndicatorLabel,
  themePreference,
  variantPreference,
  onSetTheme,
  onSetVariant,
  onMooseClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', page: 'home' as const },
    { label: 'About', page: 'info' as const },
    { label: 'Feedback', page: 'feedback' as const },
    { label: 'Legal', page: 'legal' as const },
  ];

  const handleNav = (page: Parameters<typeof onNavigate>[0]) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  // Shared pill button style matching Monitoring component
  const pillBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 shadow-lg shadow-black/20 backdrop-blur transition-colors hover:bg-white/10 hover:text-white';

  const gitUrl = import.meta.env.VITE_GITHUB_URL || `https://github.com/RaveAgainstTheMachine/${siteDomain}`;
  const supportUrl = import.meta.env.VITE_SUPPORT_URL || `https://buymeacoffee.com/${siteDomain}`;
  const copyrightHolder = import.meta.env.VITE_COPYRIGHT_HOLDER || 'p2p.red';

  return (
    <footer className="app-footer relative z-[60] mt-auto border-t border-white/10 bg-[var(--theme-bg-1)] pb-8 sm:pb-0">
      {/* Mobile burger overlay — slides up from footer */}
      {mobileMenuOpen && (
        <>
          <div 
            className="sm:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="sm:hidden absolute bottom-full left-0 right-0 bg-black border-t border-white/20 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-full duration-300 max-h-[85vh] overflow-y-auto rounded-t-2xl">
            {/* Nav links - 2 Column Grid for vertical space saving */}
            <div className="px-4 pt-3 pb-2">
              <div className="grid grid-cols-2 gap-x-4 border-b border-white/5 pb-2">
                {navLinks.map(link => (
                  <button
                    key={link.page}
                    onClick={() => handleNav(link.page)}
                    className="text-left text-white/80 hover:text-white text-xs font-medium py-2 border-b border-white/5 last:border-0"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5 text-[9px] text-white/40 leading-none">
                <div className="flex-1 text-left">
                  <span className="whitespace-nowrap">© 2026 {copyrightHolder}</span>
                </div>
                <div className="flex-1 text-center">
                  <a 
                    href="https://cv.tee215.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="hover:text-white transition-colors"
                  >
                    Logo by T
                  </a>
                </div>
                <div className="flex-1 flex items-center justify-end gap-1 text-white/30">
                  <span className="uppercase tracking-tighter whitespace-nowrap">Protected by Moose</span>
                  <button onClick={onMooseClick} className="transition-transform active:scale-90">
                    <img src="/assets/security-moose.png" alt="Moose" className="h-4 w-auto opacity-60" />
                  </button>
                </div>
              </div>
            </div>

            {/* Theme picker section in burger */}
            {onSetTheme && onSetVariant && (
              <div className="px-4 pb-3 border-t border-white/10 pt-1.5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Brightness</p>
                  <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
                    {[
                      { id: 'light', icon: Sun },
                      { id: 'brighter-dark', icon: CloudSun },
                      { id: 'dark', icon: Moon },
                    ].map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => onSetTheme(id)}
                        className={`flex h-7 w-10 items-center justify-center rounded-lg transition-all border border-transparent ${themePreference === id ? 'bg-white/20 text-white border-white/20' : 'text-white/40 hover:text-white'}`}
                      >
                        <Icon size={12} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">Theme Color</p>
                <div className="grid grid-cols-6 gap-1">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onSetVariant(theme.id)}
                    className={`group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${variantPreference === theme.id ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-black' : 'hover:scale-105'}`}
                    title={theme.name}
                  >
                    {theme.id === 'random' ? (
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/10 text-white/70">
                        <Shuffle size={12} />
                      </div>
                    ) : (
                      <div
                        className="h-full w-full rounded-lg border border-white/10"
                        style={{ background: `linear-gradient(135deg, ${'colors' in theme ? theme.colors[0] : '#fff'}, ${'colors' in theme ? theme.colors[1] : '#000'})` }}
                      />
                    )}
                    {variantPreference === theme.id && (
                      <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-black shadow-sm">
                        <Check size={8} strokeWidth={4} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    )}

      <div className="mx-auto w-full max-w-none px-3 sm:px-4 py-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 items-center justify-items-stretch gap-2 w-full text-[clamp(10px,2vw,13px)]">

          {/* Left: Version pill */}
          <div className="flex items-center justify-start shrink-0">
            {buildIndicatorClass && buildIndicatorLabel && (
              <a
                href={gitUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View GitHub repository"
                className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/90 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95 cursor-pointer"
              >
                <span className={`h-2 w-2 rounded-full ${buildIndicatorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0`} />
                <span className="truncate max-w-[90px] sm:max-w-none">
                  {displayVersion.startsWith('v') ? displayVersion : `v${displayVersion}`}
                </span>
                <div className="hidden lg:flex max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-500 group-hover:max-w-[200px] group-hover:opacity-100 items-center">
                  <span className="text-white/30 mx-2">•</span>
                  <span className="text-white/40 tracking-normal font-medium lowercase">{buildIndicatorLabel}</span>
                </div>
              </a>
            )}
          </div>

          {/* Center: Desktop nav links — hidden on mobile */}
          <div className="hidden sm:flex flex-wrap items-center justify-center justify-self-center gap-x-4 gap-y-2 text-white/75 whitespace-nowrap">
            <button onClick={() => onNavigate('home')} className="group inline-flex items-center gap-2 hover:text-white transition-colors">
              <Logo size="small" useFavicon className="transition-transform group-hover:scale-110" />
              <span className="font-semibold tracking-wide">Home</span>
            </button>
            {navLinks.filter(l => l.page !== 'home').map(link => (
              <button key={link.page} onClick={() => onNavigate(link.page)} className="hover:text-white transition-colors">
                {link.label}
              </button>
            ))}
            <button 
              onClick={onMooseClick}
              className="group relative inline-flex items-center"
            >
              <img src="/assets/security-moose.png" alt="Security Moose" className="h-[20px] w-auto opacity-70 hover:opacity-100 hover:scale-110 cursor-help transition-all" />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Guarded by the Security Moose
              </span>
            </button>
            <span className="text-white/70">© 2026 {copyrightHolder}</span>
            <a href="https://cv.tee215.com/" target="_blank" rel="noopener noreferrer" className="group text-white/70 hover:text-white transition-colors">
              Logo by <span className="text-blue-400 group-hover:text-blue-300">T</span>
            </a>
          </div>

          {/* Right: status + support + burger */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <Monitoring placement="footer" />
            {/* Support — same pill shape as Monitoring */}
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={pillBtn}
              title="Support the project"
            >
              <Coffee size={16} />
            </a>
            {/* Mobile only: burger */}
            <button
              className={`sm:hidden ${pillBtn}`}
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
};
