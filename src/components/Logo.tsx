import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  useFavicon?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium' as const, className = '', useFavicon = false }) => {
  const sizeClasses: Record<'small' | 'medium' | 'large', string> = {
    small: 'w-[81px] h-[99px]',
    medium: 'w-[162px] h-[198px]',
    large: 'w-[324px] h-[397px]'
  };

  const faviconSizeClasses: Record<'small' | 'medium' | 'large', string> = {
    small: 'w-[20px] h-[20px]',
    medium: 'w-[32px] h-[32px]',
    large: 'w-[64px] h-[64px]'
  };

  if (useFavicon) {
    return (
      <div className={`inline-block ${className}`}>
        <img 
          src="/favicon.svg" 
          alt="P2P.RED Icon"
          className={`${faviconSizeClasses[size]} object-contain`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-block ${className}`}>
      <img 
        src="/logo.svg" 
        alt="P2P.RED Logo"
        className={`${sizeClasses[size]} object-contain`}
      />
    </div>
  );
};
