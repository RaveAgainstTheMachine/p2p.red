import React from 'react';

export const GlowBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Base Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--theme-bg-1)] via-[var(--theme-bg-2)] to-[var(--theme-bg-3)]" />
      
      {/* Animated Overlay */}
      <div className="absolute inset-0 app-overlay-accent animate-gradient-shift opacity-30" />
      
      {/* Vibrant Glow Blobs */}
      <div className="absolute -top-32 -right-20 h-[40rem] w-[40rem] rounded-full bg-[var(--theme-primary)] opacity-20 blur-[100px] animate-glow-pulse" />
      <div className="absolute -bottom-24 -left-16 h-[50rem] w-[50rem] rounded-full bg-[var(--theme-accent)] opacity-15 blur-[120px] animate-glow-pulse" 
           style={{ animationDelay: '-3s' }} />
           
      {/* Subtle Grid or Texture (Optional but adds depth) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
    </div>
  );
};
