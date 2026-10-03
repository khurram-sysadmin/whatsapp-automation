import React from 'react';
import logoUrl from '../../assets/logo.jpg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const EightbitLogo: React.FC<LogoProps> = ({ size = 'md' }) => {
  const containerSizes = {
    sm: 'h-8 w-36',
    md: 'h-11 w-44',
    lg: 'h-16 w-60',
  };

  return (
    <div className={`flex shrink-0 items-center justify-center ${containerSizes[size]} select-none`}>
      {/* Frame the original artwork without stretching or clipping its lettering. */}
      <svg viewBox="144 377 780 300" role="img" aria-label="Eightbit Solutions" className="w-full h-full" style={{ mixBlendMode: 'multiply' }}>
        <image href={logoUrl} width="1024" height="1024" />
      </svg>
    </div>
  );
};
