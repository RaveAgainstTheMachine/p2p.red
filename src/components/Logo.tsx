import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: { width: 32, height: 10 },
    medium: { width: 48, height: 16 },
    large: { width: 64, height: 19 }
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
