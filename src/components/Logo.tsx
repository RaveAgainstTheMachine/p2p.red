import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'w-[81px] h-[99px]',
    medium: 'w-[162px] h-[198px]',
    large: 'w-[324px] h-[397px]'
  };

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
