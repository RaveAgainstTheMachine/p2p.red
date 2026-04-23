import React, { useState } from 'react';
import { Coffee, Menu, X } from 'lucide-react';
import { Monitoring } from './Monitoring';
import { Logo } from './Logo';

interface AppFooterProps {
  onNavigate: (page: 'landing' | 'home' | 'legal' | 'info' | 'changelog' | 'feedback') => void;
  displayVersion?: string;
  buildIndicatorClass?: string;
  buildIndicatorLabel?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ 
  onNavigate, 
  displayVersion = 'v1.5.8',
  buildIndicatorClass,
  buildIndicatorLabel
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', page: 'home' as const },
    { label: 'About', page: 'info' as const },
    { label: 'Feedback', page: 'feedback' as const },
    { label: 'Legal', page: 'legal' as const },
    { label: 'Changelog', page: 'changelog' as const },
  ];

  const handleNav = (page: Parameters<typeof onNavigate>[0]) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <footer className="app-footer relative z-10 mt-auto border-t border-white/10">
      {/* Mobile burger menu overlay */}
      {mobileMenuOpen && (
        <div className="sm:hidden absolute bottom-full left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 px-4 py-4 flex flex-col gap-3 z-50">
          {navLinks.map(link => (
            <button
              key={link.page}
              onClick={() => handleNav(link.page)}
              className="text-left text-white/80 hover:text-white text-sm font-medium py-1.5 border-b border-white/5 last:border-0"
            >
              {link.label}
            </button>
          ))}
          <a
            href="https://cv.tee215.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white text-sm py-1"
          >
            Logo by <span className="text-blue-400">T</span>
          </a>
          <span className="text-white/50 text-xs">© 2026 Steven Frost</span>
        </div>
      )}

      <div className="mx-auto w-full max-w-none px-3 sm:px-4 py-1.5">
        <div className="flex items-center justify-between gap-2 w-full text-[clamp(10px,2vw,13px)] text-white/80">

          {/* Left: Version pill */}
          <div className="flex items-center shrink-0">
            {buildIndicatorClass && buildIndicatorLabel && (
              <button
                onClick={() => onNavigate('changelog')}
                title="Click to view changelog"
                className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/90 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
              >
                <span className={`h-2 w-2 rounded-full ${buildIndicatorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)] shrink-0`} />
                <span className="truncate max-w-[80px] sm:max-w-none">{displayVersion}</span>
                <div className="hidden sm:flex max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-500 group-hover:max-w-[200px] group-hover:opacity-100 items-center">
                  <span className="text-white/30 mx-2">•</span>
                  <span className="text-white/40 tracking-normal font-medium lowercase">{buildIndicatorLabel}</span>
                </div>
              </button>
            )}
          </div>

          {/* Center: Desktop nav links — hidden on mobile */}
          <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <button
              onClick={() => onNavigate('home')}
              className="group inline-flex items-center gap-2 whitespace-nowrap leading-none text-white/70 transition-all hover:text-white"
            >
              <Logo size="small" useFavicon className="transition-transform group-hover:scale-110" />
              <span className="font-semibold tracking-wide">Home</span>
            </button>
            {navLinks.filter(l => l.page !== 'home').map(link => (
              <button
                key={link.page}
                onClick={() => onNavigate(link.page)}
                className="inline-flex items-center whitespace-nowrap leading-none text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </button>
            ))}
            <span className="group relative inline-flex items-center whitespace-nowrap leading-none">
              <img 
                src="/assets/security-moose.png" 
                alt="Security Moose" 
                className="h-[20px] w-auto opacity-70 transition-all hover:opacity-100 hover:scale-110 cursor-help"
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Guarded by the Security Moose
              </span>
            </span>
            <span className="inline-flex items-center whitespace-nowrap leading-none text-white/70">© 2026 Steven Frost</span>
            <a
              href="https://cv.tee215.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 whitespace-nowrap leading-none text-white/70"
            >
              <span className="whitespace-nowrap">Logo by</span>
              <span className="text-blue-400 transition-colors group-hover:text-blue-300">T</span>
            </a>
          </div>

          {/* Right: Support + status + mobile burger */}
          <div className="flex items-center gap-2 shrink-0">
            <Monitoring placement="footer" />
            <a
              href="https://buymeacoffee.com/p2p.red"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none px-2.5 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 transition-all hover:bg-yellow-400/20 hover:scale-105 active:scale-95"
            >
              <Coffee size={13} />
              <span className="font-semibold tracking-wide hidden sm:inline">Support</span>
            </a>
            {/* Mobile only: burger */}
            <button
              className="sm:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
};
