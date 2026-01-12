import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: { width: 64, height: 19 },
    medium: { width: 96, height: 32 },
    large: { width: 128, height: 38 }
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
