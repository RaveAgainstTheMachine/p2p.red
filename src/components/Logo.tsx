import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: { width: 81, height: 99 },
    medium: { width: 162, height: 198 },
    large: { width: 324, height: 397 }
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
