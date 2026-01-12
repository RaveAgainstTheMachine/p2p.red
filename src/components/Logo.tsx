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
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#60A5FA', stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#3B82F6', stopOpacity:1}} />
          </linearGradient>
        </defs>
        
        <text 
          x="60" 
          y={height * 0.7} 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontSize={fontSize} 
          fontWeight="700" 
          textAnchor="middle" 
          fill="url(#logoGradient)"
        >
          P2P
        </text>
      </svg>
    </div>
  );
};
