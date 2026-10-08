import React from 'react';

interface KelisimLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const KelisimLogo: React.FC<KelisimLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
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

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Shield Logo Emblem */}
      <div className="relative">
        {/* Ambient neon glow behind shield */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-400/25 to-cyan-500/20 blur-md opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        
        <div className={`relative ${iconDimensions} rounded-xl overflow-hidden bg-[#0c1217] border border-emerald-500/40 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:border-emerald-400 group-hover:shadow-[0_0_25px_rgba(45,212,191,0.35)] transition-all duration-300 flex items-center justify-center`}>
          <img
            src="/src/assets/images/kelisim_shield_logo_1791437995809.jpg"
            alt="Kelisim Logo"
            className="w-full h-full object-cover rounded-lg transform scale-105 group-hover:scale-110 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
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
