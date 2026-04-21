import React from 'react';
import { Coffee } from 'lucide-react';
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
  displayVersion = 'v1.5.2',
  buildIndicatorClass,
  buildIndicatorLabel
}) => {
  return (
    <footer className="app-footer relative z-10 mt-auto border-t border-white/10">
      <div className="mx-auto w-full max-w-none px-[15px] py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 w-full text-[clamp(10px,2vw,13px)] text-white/60">
          {/* Left: Version */}
          <div className="flex items-center">
            {buildIndicatorClass && buildIndicatorLabel && (
              <button
                onClick={() => onNavigate('changelog')}
                title="Click to view changelog"
                className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
              >
                <span className={`h-2 w-2 rounded-full ${buildIndicatorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />
                <span>{displayVersion}</span>
                <div className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-500 group-hover:max-w-[200px] group-hover:opacity-100 flex items-center">
                  <span className="text-white/30 mx-2">•</span>
                  <span className="text-white/40 tracking-normal font-medium lowercase">{buildIndicatorLabel}</span>
                </div>
              </button>
            )}
          </div>

          {/* Center: Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button
              onClick={() => onNavigate('home')}
              className="group inline-flex items-center gap-2 whitespace-nowrap leading-none text-white/60 transition-all hover:text-white"
            >
              <Logo size="small" useFavicon className="transition-transform group-hover:scale-110" />
              <span className="font-semibold tracking-wide">Home</span>
            </button>
            <button
              onClick={() => onNavigate('info')}
              className="inline-flex items-center whitespace-nowrap leading-none text-white/60 transition-colors hover:text-white"
            >
              About
            </button>
            <button
              onClick={() => onNavigate('feedback')}
              className="inline-flex items-center whitespace-nowrap leading-none text-white/60 transition-colors hover:text-white"
            >
              Feedback
            </button>
            <span className="group relative inline-flex items-center whitespace-nowrap leading-none text-white/60">
              <span className="text-base" role="img" aria-label="Canada">🇨🇦</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-black/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Proudly made in Canada
              </span>
            </span>
            <button
              onClick={() => onNavigate('legal')}
              className="inline-flex items-center whitespace-nowrap leading-none text-white/60 transition-colors hover:text-white"
            >
              Legal
            </button>
            <span className="inline-flex items-center whitespace-nowrap leading-none text-white/60">© 2026 Steven Frost</span>
            <a
              href="https://cv.tee215.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 whitespace-nowrap leading-none text-white/50"
            >
              <span className="whitespace-nowrap">Logo by</span>
              <span className="text-blue-400 transition-colors group-hover:text-blue-300">T</span>
            </a>
            <a
              href="https://buymeacoffee.com/p2p.red"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none px-3 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 transition-all hover:bg-yellow-400/20 hover:scale-105 active:scale-95 ml-2"
            >
              <Coffee size={14} />
              <span className="font-semibold tracking-wide">Support</span>
            </a>
          </div>

          {/* Right: Status */}
          <div className="flex items-center">
            <Monitoring placement="footer" />
          </div>
        </div>
      </div>
    </footer>
  );
};
