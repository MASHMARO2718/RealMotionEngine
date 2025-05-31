/**
 * Coordinate Axes Overlay Component
 * Displays XYZ coordinate system axes on camera view
 */

import React from 'react';

interface CoordinateAxesOverlayProps {
  width: number;
  height: number;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: number;
}

export default function CoordinateAxesOverlay({
  width,
  height,
  className = '',
  position = 'bottom-left',
  size = 60
}: CoordinateAxesOverlayProps) {
  // 配置位置の計算
  const getPositionStyles = () => {
    const margin = 20;
    switch (position) {
      case 'top-left':
        return { top: margin, left: margin };
      case 'top-right':
        return { top: margin, right: margin };
      case 'bottom-left':
        return { bottom: margin, left: margin };
      case 'bottom-right':
        return { bottom: margin, right: margin };
      default:
        return { bottom: margin, left: margin };
    }
  };

  const axisLength = size * 0.8;
  const center = size / 2;

  return (
    <div
      className={`absolute pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        ...getPositionStyles(),
        zIndex: 20
      }}
    >
      {/* 背景円 */}
      <div
        className="absolute rounded-full bg-black bg-opacity-40 border border-white border-opacity-30"
        style={{
          width: size,
          height: size,
          top: 0,
          left: 0
        }}
      />

      {/* SVG座標軸 */}
      <svg
        width={size}
        height={size}
        className="absolute top-0 left-0"
        style={{ overflow: 'visible' }}
      >
        {/* X軸 (赤) - 右向き */}
        <g>
          <line
            x1={center}
            y1={center}
            x2={center + axisLength * 0.6}
            y2={center}
            stroke="#ff4444"
            strokeWidth="3"
            markerEnd="url(#arrowhead-x)"
          />
          <text
            x={center + axisLength * 0.7}
            y={center - 5}
            fill="#ff4444"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            X
          </text>
        </g>

        {/* Y軸 (緑) - 上向き（画面では下向きに描画） */}
        <g>
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - axisLength * 0.6}
            stroke="#44ff44"
            strokeWidth="3"
            markerEnd="url(#arrowhead-y)"
          />
          <text
            x={center - 10}
            y={center - axisLength * 0.7}
            fill="#44ff44"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            Y
          </text>
        </g>

        {/* Z軸 (青) - 手前向き（斜め） */}
        <g>
          <line
            x1={center}
            y1={center}
            x2={center - axisLength * 0.4}
            y2={center + axisLength * 0.4}
            stroke="#4444ff"
            strokeWidth="3"
            markerEnd="url(#arrowhead-z)"
          />
          <text
            x={center - axisLength * 0.5}
            y={center + axisLength * 0.5 + 15}
            fill="#4444ff"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            Z
          </text>
        </g>

        {/* 矢印マーカー定義 */}
        <defs>
          <marker
            id="arrowhead-x"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#ff4444"
            />
          </marker>
          <marker
            id="arrowhead-y"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#44ff44"
            />
          </marker>
          <marker
            id="arrowhead-z"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#4444ff"
            />
          </marker>
        </defs>
      </svg>

      {/* 座標系ラベル */}
      <div
        className="absolute text-white text-xs font-bold bg-black bg-opacity-60 px-2 py-1 rounded"
        style={{
          bottom: -25,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap'
        }}
      >
        MediaPipe座標系
      </div>
    </div>
  );
} 