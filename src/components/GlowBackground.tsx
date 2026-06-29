import React from 'react';

export const GlowBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Base Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-bg-1)] via-[var(--theme-bg-2)] to-[var(--theme-bg-3)]" />
      
      {/* Animated Overlay */}
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift opacity-30" />
      
      {/* Vibrant Glow Blobs - Scaled proportionally */}
      <div 
        className="absolute top-1/2 -left-[20%] -translate-y-1/2 sm:top-[-10%] sm:right-[-10%] sm:translate-y-0 h-[60vw] w-[60vw] sm:h-[40rem] sm:w-[40rem] rounded-full bg-[var(--theme-primary)] opacity-20 blur-[60px] sm:blur-[100px] animate-glow-pulse" 
      />
      <div 
        className="absolute top-1/2 -right-[20%] -translate-y-1/2 sm:bottom-[-15%] sm:left-[-15%] sm:top-auto sm:translate-y-0 h-[80vw] w-[80vw] sm:h-[50rem] sm:w-[50rem] rounded-full bg-[var(--theme-accent)] opacity-15 blur-[80px] sm:blur-[120px] animate-glow-pulse" 
        style={{ animationDelay: '-3s' }} 
      />
           
      {/* Subtle Grid or Texture (Optional but adds depth) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
    </div>
  );
};
