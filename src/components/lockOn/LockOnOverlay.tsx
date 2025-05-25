/**
 * Lock-On Overlay Component
 * Provides visual feedback for the lock-on system state
 */

import { useEffect, useRef } from 'react';

type LockState = 'SEARCHING' | 'LOCKING' | 'LOCKED' | 'LOST';

interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LockOnOverlayProps {
  roi: ROI | null;
  state: LockState;
  width: number;
  height: number;
  className?: string;
}

const stateStyles = {
  SEARCHING: {
    borderColor: 'border-white',
    animation: '',
    opacity: 'opacity-60'
  },
  LOCKING: {
    borderColor: 'border-white',
    animation: 'animate-ping',
    opacity: 'opacity-80'
  },
  LOCKED: {
    borderColor: 'border-white',
    animation: 'animate-pulse',
    opacity: 'opacity-95'
  },
  LOST: {
    borderColor: 'border-red-500',
    animation: 'animate-blink',
    opacity: 'opacity-70'
  }
};

export default function LockOnOverlay({
  roi,
  state,
  width,
  height,
  className = ''
}: LockOnOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const style = stateStyles[state];

  // 🔍 デバッグ：LockOnOverlay の状態をログ出力
  console.log('🖼️ LockOnOverlay render:', {
    roi,
    state,
    width,
    height,
    hasROI: !!roi
  });

  useEffect(() => {
    // Add custom blink animation for LOST state if not already defined
    if (state === 'LOST') {
      const styleEl = document.getElementById('lockon-styles');
      if (!styleEl) {
        const style = document.createElement('style');
        style.id = 'lockon-styles';
        style.textContent = `
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
          .animate-blink {
            animation: blink 1s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, [state]);

  if (!roi) {
    console.log('❌ LockOnOverlay: ROI is null, not rendering');
    return null;
  }

  console.log('✅ LockOnOverlay: Rendering with ROI:', roi);

  return (
    <div
      ref={overlayRef}
      className={`absolute pointer-events-none ${className}`}
      style={{
        width: width,
        height: height,
        top: 0,
        left: 0,
        zIndex: 10,
        pointerEvents: 'none'
      }}
    >
      {/* Main lock-on rectangle */}
      <div
        className={`
          absolute border-4 rounded-lg transition-all duration-300
          ${style.animation} ${style.opacity}
        `}
        style={{
          left: `${(roi.x / width) * 100}%`,
          top: `${(roi.y / height) * 100}%`,
          width: `${(roi.width / width) * 100}%`,
          height: `${(roi.height / height) * 100}%`,
          borderColor: state === 'LOST' ? '#ef4444' : '#00ff00', // 🟢 緑色で見やすく
          borderWidth: '3px', // 🟢 適度な太さ
          backgroundColor: state === 'LOCKED' ? 'rgba(0, 255, 0, 0.1)' : 'transparent', // 🟢 薄い緑の背景
          boxShadow: `0 0 15px ${state === 'LOST' ? '#ef4444' : '#00ff00'}`, // 🟢 緑のグロー
          zIndex: 10 // 🟢 適切な前面表示
        }}
      >
        {/* Corner indicators */}
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
          <div
            key={corner}
            className={`
              absolute w-4 h-4 border-2
              ${getCornerClasses(corner)}
            `}
            style={{
              borderColor: state === 'LOST' ? '#ef4444' : '#00ff00', // 🟢 緑色に統一
              boxShadow: `0 0 8px ${state === 'LOST' ? '#ef4444' : '#00ff00'}`
            }}
          />
        ))}

        {/* State indicator */}
        <div
          className={`
            absolute -top-8 left-1/2 transform -translate-x-1/2
            px-3 py-1 rounded-full text-xs font-bold text-white
            ${getStateBackgroundColor(state)}
            ${style.animation}
          `}
        >
          {getStateLabel(state)}
        </div>

        {/* Track ID indicator */}
        {state === 'LOCKED' && (
          <div
            className="
              absolute -bottom-8 right-0
              px-2 py-1 rounded bg-white text-black text-xs font-mono font-bold
            "
          >
            LOCK
          </div>
        )}
      </div>

      {/* Crosshair for center targeting - always visible when ROI exists */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${((roi.x + roi.width / 2) / width) * 100}%`,
          top: `${((roi.y + roi.height / 2) / height) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div 
          className={`w-8 h-8 border-2 rounded-full ${style.animation}`}
          style={{
            borderColor: state === 'LOST' ? '#ef4444' : '#00ff00' // 🟢 緑色に統一
          }}
        >
          <div className={`absolute top-1/2 left-1/2 w-4 h-0.5 transform -translate-x-1/2 -translate-y-1/2`} 
               style={{ backgroundColor: state === 'LOST' ? '#ef4444' : '#00ff00' }} />
          <div className={`absolute top-1/2 left-1/2 w-0.5 h-4 transform -translate-x-1/2 -translate-y-1/2`} 
               style={{ backgroundColor: state === 'LOST' ? '#ef4444' : '#00ff00' }} />
        </div>
      </div>
    </div>
  );
}

function getCornerClasses(corner: string): string {
  switch (corner) {
    case 'top-left':
      return '-top-1 -left-1 border-r-0 border-b-0';
    case 'top-right':
      return '-top-1 -right-1 border-l-0 border-b-0';
    case 'bottom-left':
      return '-bottom-1 -left-1 border-r-0 border-t-0';
    case 'bottom-right':
      return '-bottom-1 -right-1 border-l-0 border-t-0';
    default:
      return '';
  }
}

function getGlowColor(state: LockState): string {
  switch (state) {
    case 'SEARCHING':
      return 'rgba(255, 255, 255, 0.5)'; // white
    case 'LOCKING':
      return 'rgba(255, 255, 255, 0.7)'; // white
    case 'LOCKED':
      return 'rgba(255, 255, 255, 0.9)'; // bright white
    case 'LOST':
      return 'rgba(239, 68, 68, 0.7)'; // red-500
    default:
      return 'rgba(255, 255, 255, 0.5)';
  }
}

function getStateBackgroundColor(state: LockState): string {
  switch (state) {
    case 'SEARCHING':
      return 'bg-gray-800';  // Dark background for white text
    case 'LOCKING':
      return 'bg-gray-900';  // Darker background for white text
    case 'LOCKED':
      return 'bg-black';     // Black background for white text
    case 'LOST':
      return 'bg-red-500';
    default:
      return 'bg-gray-800';
  }
}

function getStateLabel(state: LockState): string {
  switch (state) {
    case 'SEARCHING':
      return 'SEARCHING';
    case 'LOCKING':
      return 'LOCKING...';
    case 'LOCKED':
      return 'LOCKED';
    case 'LOST':
      return 'LOST';
    default:
      return 'UNKNOWN';
  }
} 