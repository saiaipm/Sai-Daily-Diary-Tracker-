import React from 'react';

interface ProductIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function cleanProductName(name: string): string {
  return name.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Emoji}/gu, '').trim();
}

export default function ProductIcon({ name, size = 18, className = "" }: ProductIconProps) {
  const cleanName = cleanProductName(name).toLowerCase();
  
  const isCurd = cleanName.includes('curd') || cleanName.includes('yogurt') || cleanName.includes('dahi');
  const isMilk = cleanName.includes('milk') || cleanName.includes('doodh');

  const baseClass = "flex items-center justify-center shrink-0 w-10 h-10 rounded-2xl border transition";

  if (isCurd) {
    return (
      <div className={`${baseClass} bg-amber-50 border-amber-100 text-amber-600 ${className}`} title="Curd Sachet">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Outer square sachet pouch */}
          <rect x="4" y="4" width="16" height="16" rx="2" />
          {/* Crimped top seal crimps */}
          <line x1="4" y1="7" x2="20" y2="7" strokeDasharray="2 1" />
          {/* Crimped bottom seal crimps */}
          <line x1="4" y1="17" x2="20" y2="17" strokeDasharray="2 1" />
          {/* A cream cup / drop symbol in center */}
          <path d="M12 9.5c-1 1.2-1.2 1.8-1.2 2.5a1.2 1.2 0 1 0 2.4 0c0-.7-.2-1.3-1.2-2.5z" fill="currentColor" fillOpacity="0.25" />
        </svg>
      </div>
    );
  }

  if (isMilk) {
    return (
      <div className={`${baseClass} bg-blue-50 border-blue-100 text-blue-600 ${className}`} title="Milk Bottle">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Cap */}
          <rect x="9" y="2" width="6" height="2" rx="0.5" />
          {/* Bottle shape */}
          <path d="M10 4v3L8 10.5v9.5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9.5L14 7V4" />
          {/* Middle label line */}
          <path d="M8 13.5h8" />
          {/* Mini droplet on label */}
          <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // Fallback visual icon for other dairy/miscellaneous items
  return (
    <div className={`${baseClass} bg-slate-50 border-slate-100 text-slate-500 ${className}`} title="Dairy Product">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2v20M18 2v20M6 12h12M12 6a3 3 0 1 0 0 6 3 3 0 1 0 0-6" />
      </svg>
    </div>
  );
}
