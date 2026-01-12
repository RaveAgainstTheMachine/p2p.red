import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: { width: 80, height: 24 },
    medium: { width: 120, height: 40 },
    large: { width: 160, height: 48 }
  };

  const { width, height } = sizeMap[size];

  return (
    <div className={`inline-block ${className}`}>
      <img 
        src="/logo.svg" 
        alt="P2P.RED Logo"
        width={width}
        height={height}
        className="w-full h-full"
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
};
