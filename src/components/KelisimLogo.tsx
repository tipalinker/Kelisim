import React, { useState } from 'react';
import shieldLogoImg from '../assets/images/kelisim_shield_logo_1791437995809.jpg';

interface KelisimLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const KelisimLogo: React.FC<KelisimLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
  interactive,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(shieldLogoImg);

  const isInteractive = interactive !== undefined ? interactive : Boolean(onClick);

  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10 sm:w-11 sm:h-11',
    lg: 'w-14 h-14',
  }[size];

  const titleSize = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const subtitleSize = {
    sm: 'text-[8px] tracking-[0.14em]',
    md: 'text-[9px] sm:text-[10px] tracking-[0.16em]',
    lg: 'text-[11px] sm:text-[12px] tracking-[0.2em]',
  }[size];

  const handleImageError = () => {
    // If bundled import fails, try public /logo.jpg, then /kelisim_shield_logo_1791437995809.jpg, then fallback SVG
    if (currentSrc !== '/logo.jpg' && currentSrc !== '/kelisim_shield_logo_1791437995809.jpg') {
      setCurrentSrc('/logo.jpg');
    } else if (currentSrc === '/logo.jpg') {
      setCurrentSrc('/kelisim_shield_logo_1791437995809.jpg');
    } else {
      setImageFailed(true);
    }
  };

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={`inline-flex items-center gap-3 select-none ${
        isInteractive ? 'cursor-pointer group' : 'cursor-default pointer-events-none select-none'
      } ${className}`}
    >
      {/* Shield Logo Emblem */}
      <div className="relative">
        {/* Ambient neon glow behind shield */}
        <div
          className={`absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-400/25 to-cyan-500/20 blur-md opacity-75 pointer-events-none ${
            isInteractive ? 'group-hover:opacity-100 transition-opacity duration-300' : ''
          }`}
        />
        
        <div
          className={`relative ${iconDimensions} rounded-xl overflow-hidden bg-[#0c1217] border border-emerald-500/40 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.2)] ${
            isInteractive
              ? 'group-hover:border-emerald-400 group-hover:shadow-[0_0_25px_rgba(45,212,191,0.35)] transition-all duration-300'
              : ''
          } flex items-center justify-center`}
        >
          {!imageFailed ? (
            <img
              src={currentSrc}
              alt="Kelisim Logo"
              onError={handleImageError}
              className={`w-full h-full object-cover rounded-lg transform scale-105 ${
                isInteractive ? 'group-hover:scale-110 transition-transform duration-300' : ''
              }`}
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-[#0c171e] to-teal-950 flex items-center justify-center rounded-lg text-emerald-400">
              <svg className="w-3/4 h-3/4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(16, 185, 129, 0.2)" />
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className={`font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 drop-shadow-sm font-sans ${titleSize}`}>
            KELISIM
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-sm">
            KZ
          </span>
        </div>
        {showSubtitle && (
          <span className={`uppercase font-semibold text-emerald-400/90 font-mono ${subtitleSize} -mt-0.5`}>
            LEGAL-TECH BLOCKCHAIN
          </span>
        )}
      </div>
    </div>
  );
};
