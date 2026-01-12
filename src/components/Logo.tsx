import React from 'react';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: { width: 80, height: 24, fontSize: 16 },
    medium: { width: 120, height: 40, fontSize: 24 },
    large: { width: 160, height: 48, fontSize: 32 }
  };

  const { width, height, fontSize } = sizeMap[size];

  return (
    <div className={`inline-block ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 120 40" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <text 
          x="60" 
          y={height * 0.7} 
          fontFamily="Arial, sans-serif" 
          fontSize={fontSize} 
          fontWeight="bold" 
          textAnchor="middle" 
          fill="#60A5FA"
        >
          P2P
        </text>
      </svg>
    </div>
  );
};
