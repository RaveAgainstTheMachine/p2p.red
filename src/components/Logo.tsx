import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  useFavicon?: boolean;
  color?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'medium', 
  className = '', 
  useFavicon = false,
  color = '#b01203'
}) => {
  const sizeClasses = {
    small: useFavicon ? 'w-5 h-5' : 'w-[81px] h-[99px]',
    medium: useFavicon ? 'w-10 h-10' : 'w-[162px] h-[198px]',
    large: useFavicon ? 'w-20 h-20' : 'w-[324px] h-[397px]'
  };

  const logoUrl = useFavicon ? '/favicon.svg' : '/logo.svg';

  return (
    <div className={`inline-block ${className}`}>
      <div 
        className={`${sizeClasses[size]} logo-inner`}
        style={{
          backgroundColor: color,
          maskImage: `url("${logoUrl}")`,
          WebkitMaskImage: `url("${logoUrl}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center'
        }}
        aria-label={useFavicon ? 'p2p.red icon' : 'P2P.RED Logo'}
      />
    </div>
  );
};
